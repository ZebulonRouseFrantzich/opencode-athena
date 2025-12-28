import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type { AthenaConfig, GetStoryResult } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import { getBmadPaths } from "../utils/bmad-finder.js";
import {
  extractRelevantArchitecture,
  extractRelevantPRD,
  generateImplementationInstructions,
} from "../utils/context-builder.js";
import { createPluginLogger } from "../utils/plugin-logger.js";
import { getStoryTitle, updateStoryFileStatus } from "../utils/story-file-updater.js";
import { normalizeStoryId, resolveStoryIdentifier, stripAtPrefix } from "../utils/story-loader.js";
import {
  calculateSprintProgress,
  findNextReadyStory,
  findStoryInStatus,
  readBmadSprintStatus,
  storyIdToDotFormat,
  updateEpicStatusIfNeeded,
  updateStoryStatus,
} from "../utils/yaml-handler.js";

const log = createPluginLogger("get-story");

export function createGetStoryTool(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig
): ToolDefinition {
  return tool({
    description: `Load the current BMAD story context for implementation.

Returns:
- Story file content with requirements and acceptance criteria
- Relevant architecture sections
- Sprint progress information
- Implementation instructions for using Sisyphus and subagents

When loading a 'ready-for-dev' story, it will automatically be transitioned to 'in-progress'.

Use this tool before starting story implementation to get full context.`,

    args: {
      storyId: tool.schema
        .string()
        .optional()
        .describe(
          "Story ID (e.g., '2.3') or file path (e.g., 'docs/stories/story-2-3.md'). If omitted, loads the next ready story."
        ),
    },

    async execute(args): Promise<string> {
      const result = await getStoryContext(ctx, tracker, config, args.storyId);
      return JSON.stringify(result, null, 2);
    },
  });
}

async function getStoryContext(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig,
  requestedStoryId?: string
): Promise<GetStoryResult> {
  log.debug("Getting story context", { requestedStoryId, directory: ctx.directory });

  const paths = await getBmadPaths(ctx.directory, config);
  if (!paths.bmadDir) {
    log.warn("BMAD directory not found", { directory: ctx.directory });
    return {
      error: "No BMAD directory found",
      suggestion: "Run 'npx bmad-method@alpha install' to set up BMAD in this project.",
    };
  }

  log.debug("Reading sprint status", { sprintStatusPath: paths.sprintStatus });
  const sprint = await readBmadSprintStatus(paths.sprintStatus);
  if (!sprint) {
    log.warn("Sprint status file not found", { sprintStatusPath: paths.sprintStatus });
    return {
      error: "No sprint-status.yaml found",
      suggestion: "Run the sprint-planning workflow with BMAD's SM agent first.",
    };
  }

  let resolvedStoryId: string;
  let storyStatus: string | undefined;

  if (requestedStoryId) {
    resolvedStoryId = normalizeStoryId(stripAtPrefix(requestedStoryId));
    const found = findStoryInStatus(sprint, resolvedStoryId);
    storyStatus = found?.status;
  } else {
    const nextStory = findNextReadyStory(sprint);
    if (!nextStory) {
      const progress = calculateSprintProgress(sprint);
      log.info("No ready stories found", { progress });
      return {
        error: "No ready stories found",
        sprintProgress: {
          completed: progress.done,
          total: progress.total,
        },
        suggestion:
          progress.done === progress.total
            ? "All stories in current sprint are complete!"
            : "No stories are ready-for-dev. Run create-story workflow to create new stories.",
      };
    }
    resolvedStoryId = nextStory.parsed.normalizedId;
    storyStatus = nextStory.status;
  }

  log.debug("Loading story file", { storyId: resolvedStoryId, storiesDir: paths.storiesDir });

  const storyResult = await resolveStoryIdentifier(
    paths.storiesDir,
    resolvedStoryId,
    ctx.directory
  );

  if (!storyResult) {
    log.error("Story file not found", { storyId: resolvedStoryId, storiesDir: paths.storiesDir });
    return {
      error: `Story file not found for ${storyIdToDotFormat(resolvedStoryId)}`,
      suggestion: "Run 'create-story' workflow with BMAD's SM agent.",
    };
  }

  const storyContent = storyResult.content;
  const storyPath = storyResult.path;

  if (storyStatus === "ready-for-dev") {
    log.info("Auto-transitioning story from ready-for-dev to in-progress", {
      storyId: resolvedStoryId,
    });

    const storyTitle = (await getStoryTitle(storyPath)) ?? undefined;

    await updateStoryStatus(paths.sprintStatus, resolvedStoryId, "in-progress", storyTitle);

    await updateStoryFileStatus(storyPath, "in-progress");

    const storyKeyInfo = findStoryInStatus(sprint, resolvedStoryId);
    if (storyKeyInfo) {
      await updateEpicStatusIfNeeded(paths.sprintStatus, storyKeyInfo.parsed.epicNum);
    }

    storyStatus = "in-progress";
  }

  log.debug("Extracting relevant architecture sections", {
    architecturePath: paths.architecture,
  });
  const archContent = await extractRelevantArchitecture(paths.architecture, storyContent);

  log.debug("Extracting relevant PRD sections", { prdPath: paths.prd });
  const prdContent = await extractRelevantPRD(paths.prd, storyContent);

  log.debug("Updating story tracker", { storyId: resolvedStoryId, status: storyStatus });
  await tracker.setCurrentStory(resolvedStoryId, {
    content: storyContent,
    status: (storyStatus as "in-progress") || "in-progress",
    startedAt: new Date().toISOString(),
  });

  const updatedSprint = await readBmadSprintStatus(paths.sprintStatus);
  const progress = updatedSprint ? calculateSprintProgress(updatedSprint) : null;

  log.info("Story context loaded successfully", {
    storyId: resolvedStoryId,
    hasArchitecture: !!archContent,
    hasPRD: !!prdContent,
    progress,
  });

  return {
    storyId: storyIdToDotFormat(resolvedStoryId),
    story: storyContent,
    architecture: archContent || "No architecture document found.",
    prd: prdContent || "No PRD document found.",
    sprint: {
      currentEpic: sprint.current_story ? sprint.current_story.split("-")[0] : "Unknown",
      completedStories: progress?.done ?? 0,
      pendingStories: (progress?.backlog ?? 0) + (progress?.readyForDev ?? 0),
      blockedStories: progress?.blocked ?? 0,
    },
    instructions: generateImplementationInstructions(storyIdToDotFormat(resolvedStoryId)),
  };
}
