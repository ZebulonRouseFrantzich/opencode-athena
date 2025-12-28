import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type { AthenaConfig, BmadStoryStatus } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import { getBmadPaths } from "../utils/bmad-finder.js";
import { sendNotification } from "../utils/notifications.js";
import { createPluginLogger } from "../utils/plugin-logger.js";
import { getStoryTitle, updateStoryFileStatus } from "../utils/story-file-updater.js";
import { findStoryFile, normalizeStoryId, stripAtPrefix } from "../utils/story-loader.js";
import {
  calculateSprintProgress,
  findNextReadyStory,
  parseStoryKey,
  readBmadSprintStatus,
  storyIdToDotFormat,
  updateEpicStatusIfNeeded,
  updateStoryStatus as updateSprintStoryStatus,
} from "../utils/yaml-handler.js";

const log = createPluginLogger("update-status");

export interface UpdateStatusResult {
  success?: boolean;
  storyId?: string;
  newStatus?: BmadStoryStatus;
  previousStatus?: string;
  updatedAt?: string;
  storyFileUpdated?: boolean;
  epicStatusUpdated?: boolean;
  epicNewStatus?: string;
  sprintProgress?: {
    total: number;
    done: number;
    inProgress: number;
    readyForDev: number;
    backlog: number;
    blocked: number;
    review: number;
    percentComplete: number;
  };
  nextStory?: string | null;
  error?: string;
}

export function createUpdateStatusTool(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig
): ToolDefinition {
  return tool({
    description: `Update the BMAD sprint status for a story.

Call this tool when:
- Starting a story (status: "in-progress")
- Completing a story (status: "done") - requires completionSummary
- Blocking on an issue (status: "blocked") - requires notes explaining blocker
- Requesting review (status: "review")

Both sprint-status.yaml and the story file's Status field will be updated.`,

    args: {
      storyId: tool.schema.string().describe("Story ID (e.g., '2.3' or '2-3') or file path"),
      status: tool.schema
        .enum(["in-progress", "review", "done", "blocked"])
        .describe("The new status (BMAD v6 hyphenated format)"),
      notes: tool.schema
        .string()
        .optional()
        .describe("Notes about the status change (required for 'blocked')"),
      completionSummary: tool.schema
        .string()
        .optional()
        .describe("Summary of what was implemented (required for 'done')"),
    },

    async execute(args): Promise<string> {
      const result = await handleUpdateStatus(ctx, tracker, config, args);
      return JSON.stringify(result, null, 2);
    },
  });
}

interface UpdateStatusArgs {
  storyId: string;
  status: "in-progress" | "review" | "done" | "blocked";
  notes?: string;
  completionSummary?: string;
}

async function handleUpdateStatus(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig,
  args: UpdateStatusArgs
): Promise<UpdateStatusResult> {
  const { status, notes, completionSummary } = args;
  const rawStoryId = stripAtPrefix(args.storyId);
  const normalizedId = normalizeStoryId(rawStoryId);

  log.debug("Updating story status", {
    storyId: normalizedId,
    status,
    hasNotes: !!notes,
    hasSummary: !!completionSummary,
  });

  if (status === "done" && !completionSummary) {
    log.warn("Validation failed: completionSummary required for done status", {
      storyId: normalizedId,
    });
    return { error: "completionSummary is required when marking a story done" };
  }

  if (status === "blocked" && !notes) {
    log.warn("Validation failed: notes required for blocked status", { storyId: normalizedId });
    return { error: "notes are required when blocking a story (explain the blocker)" };
  }

  const paths = await getBmadPaths(ctx.directory, config);
  if (!paths.bmadDir) {
    log.warn("BMAD directory not found", { directory: ctx.directory });
    return { error: "No BMAD directory found" };
  }

  if (!paths.sprintStatus) {
    log.error("Sprint status file not found");
    return { error: "No sprint-status.yaml found" };
  }

  const sprintStatus = await readBmadSprintStatus(paths.sprintStatus);
  if (!sprintStatus) {
    log.error("Failed to read sprint status file", { path: paths.sprintStatus });
    return { error: "Failed to read sprint-status.yaml" };
  }

  let storyTitle: string | undefined;
  const storyFile = await findStoryFile(paths.storiesDir, normalizedId);
  if (storyFile) {
    storyTitle = (await getStoryTitle(storyFile.path)) ?? undefined;
  }

  const updateResult = await updateSprintStoryStatus(
    paths.sprintStatus,
    normalizedId,
    status,
    storyTitle
  );

  if (!updateResult.success) {
    log.error("Failed to update sprint status", { storyId: normalizedId });
    return { error: "Failed to update sprint-status.yaml" };
  }

  let storyFileUpdated = false;
  if (storyFile) {
    const fileUpdateResult = await updateStoryFileStatus(storyFile.path, status);
    storyFileUpdated = fileUpdateResult.success;
    if (!fileUpdateResult.success) {
      log.warn("Failed to update story file status", {
        path: storyFile.path,
        error: fileUpdateResult.error,
      });
    }
  }

  const parsed = parseStoryKey(updateResult.key);
  let epicStatusUpdated = false;
  let epicNewStatus: string | undefined;

  if (parsed) {
    const epicUpdate = await updateEpicStatusIfNeeded(paths.sprintStatus, parsed.epicNum);
    if (epicUpdate.updated) {
      epicStatusUpdated = true;
      epicNewStatus = epicUpdate.newStatus;
      log.info("Auto-updated epic status", {
        epicNum: parsed.epicNum,
        newStatus: epicUpdate.newStatus,
      });
    }
  }

  const now = new Date().toISOString();
  await tracker.updateStoryStatus(normalizedId, status);

  if (config.features?.notifications && status === "done") {
    log.debug("Sending completion notification", { storyId: normalizedId });
    await sendNotification(
      `Story ${storyIdToDotFormat(normalizedId)} completed!`,
      "OpenCode Athena",
      ctx.$
    );
  }

  const updatedStatus = await readBmadSprintStatus(paths.sprintStatus);
  const progress = updatedStatus ? calculateSprintProgress(updatedStatus) : null;

  let nextStory: string | null = null;
  if (status === "done" && updatedStatus) {
    const next = findNextReadyStory(updatedStatus);
    nextStory = next ? storyIdToDotFormat(next.parsed.normalizedId) : null;
  }

  log.info("Story status updated successfully", {
    storyId: normalizedId,
    status,
    previousStatus: updateResult.previousStatus,
    storyFileUpdated,
    epicStatusUpdated,
    progress,
  });

  return {
    success: true,
    storyId: storyIdToDotFormat(normalizedId),
    newStatus: status,
    previousStatus: updateResult.previousStatus,
    updatedAt: now,
    storyFileUpdated,
    epicStatusUpdated,
    epicNewStatus,
    sprintProgress: progress ?? undefined,
    nextStory,
  };
}
