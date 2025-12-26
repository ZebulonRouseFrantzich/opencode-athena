/**
 * athena_update_status tool
 *
 * Updates the BMAD sprint status for a story.
 */

import { existsSync } from "node:fs";
import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type { AthenaConfig, StoryStatus, UpdateStatusResult } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import { getBmadPaths } from "../utils/bmad-finder.js";
import { sendNotification } from "../utils/notifications.js";
import { createPluginLogger } from "../utils/plugin-logger.js";
import { readSprintStatus, writeSprintStatus } from "../utils/yaml-handler.js";

const log = createPluginLogger("update-status");

/**
 * Create the athena_update_status tool
 */
export function createUpdateStatusTool(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig
): ToolDefinition {
  return tool({
    description: `Update the BMAD sprint status for a story.

Call this tool when:
- Starting a story (status: "in_progress")
- Completing a story (status: "completed") - requires completionSummary
- Blocking on an issue (status: "blocked") - requires notes explaining blocker
- Requesting review (status: "needs_review")

The sprint-status.yaml file will be automatically updated.`,

    args: {
      storyId: tool.schema.string().describe("The story ID (e.g., '2.3')"),
      status: tool.schema
        .enum(["in_progress", "completed", "blocked", "needs_review"])
        .describe("The new status for the story"),
      notes: tool.schema
        .string()
        .optional()
        .describe("Notes about the status change (required for 'blocked' status)"),
      completionSummary: tool.schema
        .string()
        .optional()
        .describe("Summary of what was implemented (required for 'completed' status)"),
    },

    async execute(args): Promise<string> {
      const result = await updateStoryStatus(ctx, tracker, config, args);
      return JSON.stringify(result, null, 2);
    },
  });
}

interface UpdateStatusArgs {
  storyId: string;
  status: "in_progress" | "completed" | "blocked" | "needs_review";
  notes?: string;
  completionSummary?: string;
}

/**
 * Update story status implementation
 */
async function updateStoryStatus(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig,
  args: UpdateStatusArgs
): Promise<UpdateStatusResult> {
  const { storyId, status, notes, completionSummary } = args;

  log.debug("Updating story status", {
    storyId,
    status,
    hasNotes: !!notes,
    hasSummary: !!completionSummary,
  });

  // Validation
  if (status === "completed" && !completionSummary) {
    log.warn("Validation failed: completionSummary required for completed status", { storyId });
    return {
      error: "completionSummary is required when marking a story completed",
    };
  }
  if (status === "blocked" && !notes) {
    log.warn("Validation failed: notes required for blocked status", { storyId });
    return {
      error: "notes are required when blocking a story (explain the blocker)",
    };
  }

  const paths = await getBmadPaths(ctx.directory, config);
  if (!paths.bmadDir) {
    log.warn("BMAD directory not found", { directory: ctx.directory });
    return { error: "No BMAD directory found" };
  }

  if (!existsSync(paths.sprintStatus)) {
    log.error("Sprint status file not found", { sprintStatusPath: paths.sprintStatus });
    return { error: "No sprint-status.yaml found" };
  }

  log.debug("Reading sprint status", { sprintStatusPath: paths.sprintStatus });
  const sprint = await readSprintStatus(paths.sprintStatus);
  if (!sprint) {
    log.error("Failed to read sprint status file", { sprintStatusPath: paths.sprintStatus });
    return { error: "Failed to read sprint-status.yaml" };
  }

  const now = new Date().toISOString();

  // Remove story from all status arrays
  log.debug("Removing story from all status arrays", { storyId });
  removeFromAllArrays(sprint, storyId);

  // Add to appropriate array based on new status (with deduplication)
  log.debug("Adding story to new status array", { storyId, status });
  switch (status) {
    case "in_progress":
      addToArrayIfNotPresent(sprint.in_progress_stories, storyId);
      sprint.current_story = storyId;
      break;

    case "completed":
      addToArrayIfNotPresent(sprint.completed_stories, storyId);
      if (sprint.current_story === storyId) {
        sprint.current_story = null;
      }
      break;

    case "blocked":
      addToArrayIfNotPresent(sprint.blocked_stories, storyId);
      if (sprint.current_story === storyId) {
        sprint.current_story = null;
      }
      break;

    case "needs_review":
      addToArrayIfNotPresent(sprint.in_progress_stories, storyId);
      sprint.stories_needing_review = sprint.stories_needing_review || [];
      addToArrayIfNotPresent(sprint.stories_needing_review, storyId);
      break;
  }

  // Write updated sprint status
  log.debug("Writing updated sprint status", { sprintStatusPath: paths.sprintStatus });
  await writeSprintStatus(paths.sprintStatus, sprint);

  // Update tracker
  log.debug("Updating story tracker", { storyId, status });
  await tracker.updateStoryStatus(storyId, status as StoryStatus);

  // Send notification if enabled and story completed
  if (config.features?.notifications && status === "completed") {
    log.debug("Sending completion notification", { storyId });
    await sendNotification(`Story ${storyId} completed!`, "OpenCode Athena", ctx.$);
  }

  // Calculate sprint progress
  const totalStories =
    sprint.completed_stories.length +
    sprint.pending_stories.length +
    sprint.in_progress_stories.length +
    sprint.blocked_stories.length;

  const percentComplete =
    totalStories > 0 ? Math.round((sprint.completed_stories.length / totalStories) * 100) : 0;

  log.info("Story status updated successfully", {
    storyId,
    status,
    sprintProgress: {
      completed: sprint.completed_stories.length,
      inProgress: sprint.in_progress_stories.length,
      pending: sprint.pending_stories.length,
      blocked: sprint.blocked_stories.length,
      total: totalStories,
      percentComplete,
    },
  });

  return {
    success: true,
    storyId,
    newStatus: status as StoryStatus,
    updatedAt: now,
    sprintProgress: {
      completed: sprint.completed_stories.length,
      inProgress: sprint.in_progress_stories.length,
      pending: sprint.pending_stories.length,
      blocked: sprint.blocked_stories.length,
      total: totalStories,
      percentComplete,
    },
    nextStory: status === "completed" ? sprint.pending_stories[0] || null : null,
  };
}

/**
 * Remove a story from all status arrays and deduplicate
 */
function removeFromAllArrays(
  sprint: {
    completed_stories: string[];
    pending_stories: string[];
    in_progress_stories: string[];
    blocked_stories: string[];
    stories_needing_review?: string[];
  },
  storyId: string
): void {
  // Remove the story and deduplicate arrays to prevent duplicates
  sprint.completed_stories = [...new Set(sprint.completed_stories.filter((s) => s !== storyId))];
  sprint.pending_stories = [...new Set(sprint.pending_stories.filter((s) => s !== storyId))];
  sprint.in_progress_stories = [
    ...new Set(sprint.in_progress_stories.filter((s) => s !== storyId)),
  ];
  sprint.blocked_stories = [...new Set(sprint.blocked_stories.filter((s) => s !== storyId))];
  if (sprint.stories_needing_review) {
    sprint.stories_needing_review = [
      ...new Set(sprint.stories_needing_review.filter((s) => s !== storyId)),
    ];
  }
}

/**
 * Add a story to an array if not already present
 */
function addToArrayIfNotPresent(array: string[], storyId: string): void {
  if (!array.includes(storyId)) {
    array.push(storyId);
  }
}
