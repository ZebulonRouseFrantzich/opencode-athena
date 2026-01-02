import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type {
  AthenaConfig,
  CreatedSubStory,
  DecomposeStoryResult,
  DecompositionSplit,
  DecompositionVerification,
  UserSplitConfig,
} from "../../shared/types.js";
import { getBmadPaths } from "../utils/bmad-finder.js";
import { createPluginLogger } from "../utils/plugin-logger.js";
import { assessStoryComplexity } from "../utils/story-complexity.js";
import {
  generateDecompositionSuggestions,
  generateSubStoryContent,
  getSubStoryFilename,
  getSubStoryId,
  validateSplits,
} from "../utils/story-decomposer.js";
import { normalizeStoryId, resolveStoryIdentifier, stripAtPrefix } from "../utils/story-loader.js";
import { parseStoryTasks } from "../utils/story-parser.js";
import {
  readBmadSprintStatus,
  storyIdToDotFormat,
  writeBmadSprintStatus,
} from "../utils/yaml-handler.js";

const log = createPluginLogger("decompose-story");

export function createDecomposeStoryTool(ctx: PluginInput, config: AthenaConfig): ToolDefinition {
  return tool({
    description: `Decompose a large BMAD story into smaller sub-stories.

Use after athena_analyze_story recommends decomposition.

What this tool does:
1. Validates that all tasks are accounted for (no missing/duplicates)
2. Creates new story files with suffix (e.g., 3-2a.md, 3-2b.md)
3. Updates sprint-status.yaml (removes original, adds sub-stories)
4. Preserves applicable dev notes in each sub-story
5. Returns the first story to implement

IMPORTANT: Requires confirmed=true to execute (safety check).`,

    args: {
      storyId: tool.schema.string().describe("Story ID to decompose (e.g., '3.2')"),
      splits: tool.schema
        .array(
          tool.schema.object({
            suffix: tool.schema.string().describe("Suffix for sub-story (e.g., 'a', 'b')"),
            title: tool.schema.string().optional().describe("Optional title override"),
            taskIds: tool.schema
              .array(tool.schema.string())
              .describe("Task IDs to include in this split"),
          })
        )
        .optional()
        .describe("Custom splits (if not provided, uses suggested splits from analysis)"),
      useSuggestedSplits: tool.schema
        .boolean()
        .optional()
        .describe("Use suggested splits from analysis (default: true if no custom splits)"),
      confirmed: tool.schema
        .boolean()
        .describe("Must be true to execute decomposition (safety check)"),
    },

    async execute(args): Promise<string> {
      const result = await handleDecomposeStory(ctx, config, {
        storyId: args.storyId,
        splits: args.splits as UserSplitConfig[] | undefined,
        useSuggestedSplits: args.useSuggestedSplits,
        confirmed: args.confirmed,
      });

      return JSON.stringify(result, null, 2);
    },
  });
}

interface DecomposeArgs {
  storyId: string;
  splits?: UserSplitConfig[];
  useSuggestedSplits?: boolean;
  confirmed: boolean;
}

async function handleDecomposeStory(
  ctx: PluginInput,
  config: AthenaConfig,
  args: DecomposeArgs
): Promise<DecomposeStoryResult> {
  const { confirmed, splits: customSplits, useSuggestedSplits } = args;
  const rawStoryId = stripAtPrefix(args.storyId);
  const storyId = normalizeStoryId(rawStoryId);

  log.debug("Decomposing story", { storyId, confirmed, hasCustomSplits: !!customSplits });

  if (!confirmed) {
    return createErrorResult(
      "Safety check failed: confirmed must be true to execute decomposition",
      "Set confirmed=true to proceed with story decomposition."
    );
  }

  const paths = await getBmadPaths(ctx.directory, config);
  if (!paths.storiesDir) {
    return createErrorResult(
      "No stories directory found",
      paths.suggestion ||
        "Ensure BMAD is set up with a stories directory. Athena supports both legacy (docs/) and v6-alpha (_bmad/ + _bmad-output/) structures."
    );
  }

  const resolved = await resolveStoryIdentifier(paths.storiesDir, rawStoryId, ctx.directory);
  if (!resolved) {
    return createErrorResult(
      `Story not found: ${args.storyId}`,
      "Check the story ID and try again."
    );
  }

  const { content: storyContent, filename: originalFilename, path: storyPath } = resolved;
  const parsedStory = parseStoryTasks(storyContent, storyId);

  if (parsedStory.tasks.length === 0) {
    return createErrorResult(
      "No tasks found in story",
      "Story must have tasks to decompose. Check the story format."
    );
  }

  const splitsToUse = determineSplits(customSplits, useSuggestedSplits, parsedStory, storyContent);

  if ("error" in splitsToUse) {
    return createErrorResult(splitsToUse.error, splitsToUse.suggestion, parsedStory.tasks.length);
  }

  const validation = validateSplits(parsedStory.tasks, splitsToUse);
  if (!validation.valid) {
    return {
      success: false,
      createdStories: [],
      verification: {
        originalTaskCount: parsedStory.tasks.length,
        totalTasksInSplits: splitsToUse.reduce((sum, s) => sum + s.taskIds.length, 0),
        allTasksAccountedFor: false,
        missingTasks: validation.missingTasks,
        duplicatedTasks: validation.duplicatedTasks,
        devNotesPreserved: false,
      },
      sprintStatusUpdated: false,
      originalStoryRemoved: false,
      nextStory: "",
      error: formatValidationError(validation),
      suggestion: "Ensure all tasks are included exactly once across all splits.",
    };
  }

  const createdStories = await createSubStoryFiles(
    splitsToUse,
    storyContent,
    parsedStory,
    storyId,
    originalFilename,
    paths.storiesDir
  );

  if ("error" in createdStories) {
    return {
      success: false,
      createdStories: createdStories.created,
      verification: createPartialVerification(parsedStory.tasks.length, splitsToUse),
      sprintStatusUpdated: false,
      originalStoryRemoved: false,
      nextStory: "",
      error: createdStories.error,
      suggestion: "Check file system permissions.",
    };
  }

  const sprintUpdate = await updateSprintStatus(paths.sprintStatus, storyId, createdStories);
  await archiveOriginalStory(storyPath);

  const firstReadyStory = createdStories.find((s) => s.status === "ready-for-dev");
  const nextStory = firstReadyStory
    ? storyIdToDotFormat(firstReadyStory.id)
    : storyIdToDotFormat(createdStories[0].id);

  log.info("Story decomposition complete", {
    storyId,
    createdCount: createdStories.length,
    nextStory,
    sprintStatusUpdated: sprintUpdate.updated,
    originalStoryRemoved: sprintUpdate.originalRemoved,
  });

  return {
    success: true,
    createdStories,
    verification: {
      originalTaskCount: parsedStory.tasks.length,
      totalTasksInSplits: splitsToUse.reduce((sum, s) => sum + s.taskIds.length, 0),
      allTasksAccountedFor: true,
      missingTasks: [],
      duplicatedTasks: [],
      devNotesPreserved:
        storyContent.includes("## Dev Notes") || storyContent.includes("## Implementation Notes"),
    },
    sprintStatusUpdated: sprintUpdate.updated,
    originalStoryRemoved: sprintUpdate.originalRemoved,
    nextStory,
  };
}

function createErrorResult(
  error: string,
  suggestion: string,
  originalTaskCount = 0
): DecomposeStoryResult {
  return {
    success: false,
    createdStories: [],
    verification: {
      originalTaskCount,
      totalTasksInSplits: 0,
      allTasksAccountedFor: false,
      missingTasks: [],
      duplicatedTasks: [],
      devNotesPreserved: false,
    },
    sprintStatusUpdated: false,
    originalStoryRemoved: false,
    nextStory: "",
    error,
    suggestion,
  };
}

function determineSplits(
  customSplits: UserSplitConfig[] | undefined,
  useSuggestedSplits: boolean | undefined,
  parsedStory: ReturnType<typeof parseStoryTasks>,
  storyContent: string
): DecompositionSplit[] | { error: string; suggestion: string } {
  if (customSplits && customSplits.length > 0) {
    return customSplits.map((split, index) => ({
      suffix: split.suffix,
      title: split.title || `Part ${index + 1}`,
      taskIds: split.taskIds,
      estimatedPoints: 0,
      rationale: "User-defined split",
      dependencies: [],
    }));
  }

  if (useSuggestedSplits === false) {
    return {
      error: "No splits provided and useSuggestedSplits is false",
      suggestion: "Either provide custom splits or set useSuggestedSplits=true.",
    };
  }

  const fileSizeBytes = Buffer.byteLength(storyContent, "utf-8");
  const assessment = assessStoryComplexity(parsedStory, fileSizeBytes);
  const suggestedSplits = generateDecompositionSuggestions(parsedStory, assessment.taskEfforts);

  if (suggestedSplits.length === 0) {
    return {
      error: "Could not generate decomposition suggestions",
      suggestion: "Provide custom splits using the 'splits' parameter.",
    };
  }

  return suggestedSplits;
}

function formatValidationError(validation: {
  missingTasks: string[];
  duplicatedTasks: string[];
}): string {
  const parts: string[] = [];
  if (validation.missingTasks.length > 0) {
    parts.push(`missing tasks: ${validation.missingTasks.join(", ")}`);
  }
  if (validation.duplicatedTasks.length > 0) {
    parts.push(`duplicated tasks: ${validation.duplicatedTasks.join(", ")}`);
  }
  return `Invalid splits: ${parts.join("; ")}`;
}

function createPartialVerification(
  originalTaskCount: number,
  splits: DecompositionSplit[]
): DecompositionVerification {
  return {
    originalTaskCount,
    totalTasksInSplits: splits.reduce((sum, s) => sum + s.taskIds.length, 0),
    allTasksAccountedFor: false,
    missingTasks: [],
    duplicatedTasks: [],
    devNotesPreserved: false,
  };
}

async function createSubStoryFiles(
  splits: DecompositionSplit[],
  storyContent: string,
  parsedStory: ReturnType<typeof parseStoryTasks>,
  storyId: string,
  originalFilename: string,
  storiesDir: string
): Promise<CreatedSubStory[] | { error: string; created: CreatedSubStory[] }> {
  const createdStories: CreatedSubStory[] = [];

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i];
    const subStoryFilename = getSubStoryFilename(originalFilename, split.suffix);
    const subStoryId = getSubStoryId(storyId, split.suffix);
    const subStoryPath = path.join(storiesDir, subStoryFilename);

    const subStoryContent = generateSubStoryContent(
      storyContent,
      parsedStory,
      split,
      i,
      splits.length,
      storyId
    );

    try {
      await fs.writeFile(subStoryPath, subStoryContent, "utf-8");
      log.info("Created sub-story file", { path: subStoryPath });
    } catch (err) {
      log.error("Failed to write sub-story file", { path: subStoryPath, error: err });
      return {
        error: `Failed to create sub-story file: ${subStoryFilename}`,
        created: createdStories,
      };
    }

    const hasDependencies = split.dependencies.length > 0;
    const status: "ready-for-dev" | "backlog" = hasDependencies ? "backlog" : "ready-for-dev";

    createdStories.push({
      id: subStoryId,
      filename: subStoryFilename,
      filePath: subStoryPath,
      taskCount: split.taskIds.length,
      estimatedPoints: split.estimatedPoints,
      status,
      dependencies: split.dependencies.map((d) => getSubStoryId(storyId, d)),
      hasVerificationTask: false,
    });
  }

  return createdStories;
}

async function updateSprintStatus(
  sprintStatusPath: string | undefined,
  storyId: string,
  createdStories: CreatedSubStory[]
): Promise<{ updated: boolean; originalRemoved: boolean }> {
  if (!sprintStatusPath) {
    return { updated: false, originalRemoved: false };
  }

  try {
    const sprintStatus = await readBmadSprintStatus(sprintStatusPath);
    if (!sprintStatus) {
      return { updated: false, originalRemoved: false };
    }

    let originalRemoved = false;
    const originalKeyPattern = new RegExp(`^${storyId.replace(".", "-")}(-.*)?$`);

    for (const key of Object.keys(sprintStatus.development_status)) {
      if (originalKeyPattern.test(key) && !key.includes("retrospective")) {
        delete sprintStatus.development_status[key];
        originalRemoved = true;
        log.info("Removed original story from sprint status", { key });
      }
    }

    for (const subStory of createdStories) {
      const subStoryKey = subStory.id.replace(".", "-");
      sprintStatus.development_status[subStoryKey] = subStory.status;
      log.info("Added sub-story to sprint status", { key: subStoryKey, status: subStory.status });
    }

    if (sprintStatus.current_story) {
      const currentNormalized = normalizeStoryId(sprintStatus.current_story);
      if (currentNormalized === storyId) {
        const firstReady = createdStories.find((s) => s.status === "ready-for-dev");
        sprintStatus.current_story = firstReady
          ? firstReady.id.replace(".", "-")
          : createdStories[0].id.replace(".", "-");
      }
    }

    sprintStatus.last_modified = new Date().toISOString();
    await writeBmadSprintStatus(sprintStatusPath, sprintStatus);

    return { updated: true, originalRemoved };
  } catch (err) {
    log.warn("Failed to update sprint-status.yaml", { error: err });
    return { updated: false, originalRemoved: false };
  }
}

async function archiveOriginalStory(storyPath: string): Promise<void> {
  try {
    const archivedPath = storyPath.replace(".md", ".decomposed.md");
    await fs.rename(storyPath, archivedPath);
    log.info("Archived original story", { from: storyPath, to: archivedPath });
  } catch (err) {
    log.warn("Failed to archive original story file", { error: err });
  }
}
