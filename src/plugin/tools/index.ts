/**
 * Plugin tools index
 *
 * Factory function that creates all Athena tools.
 */

import type { PluginInput, ToolDefinition } from "@opencode-ai/plugin";
import type { AthenaConfig } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import { createConfigTool } from "./config.js";
import { createGetContextTool } from "./get-context.js";
import { createGetStoryTool } from "./get-story.js";
import { createParallelTool } from "./parallel.js";
import { createReviewStoryTool } from "./review-story.js";
import { createUpdateStatusTool } from "./update-status.js";

/**
 * Create all Athena tools
 *
 * @param ctx - Plugin context from OpenCode
 * @param tracker - Story tracker instance
 * @param config - Athena configuration
 * @returns Object containing all tool definitions
 */
export function createTools(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig
): Record<string, ToolDefinition> {
  return {
    athena_get_story: createGetStoryTool(ctx, tracker, config),
    athena_update_status: createUpdateStatusTool(ctx, tracker, config),
    athena_get_context: createGetContextTool(tracker, config),
    athena_parallel: createParallelTool(),
    athena_config: createConfigTool(config),
    athena_review_story: createReviewStoryTool(ctx, config),
  };
}
