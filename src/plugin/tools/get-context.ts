/**
 * athena_get_context tool
 *
 * Quick access to current story context from tracker.
 */

import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { AthenaConfig } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";

/**
 * Create the athena_get_context tool
 */
export function createGetContextTool(tracker: StoryTracker, _config: AthenaConfig): ToolDefinition {
  return tool({
    description: `Get the current story context without reloading from files.

Returns the cached context from the story tracker including:
- Current story ID and status
- When the story was started
- Recent activity history

Use this for quick status checks. Use athena_get_story to reload full context from files.`,

    args: {},

    async execute(): Promise<string> {
      const currentStory = tracker.getCurrentStory();

      if (!currentStory) {
        return JSON.stringify({
          status: "no_active_story",
          message: "No story is currently being tracked. Use athena_get_story to load a story.",
        });
      }

      const context = await tracker.getCurrentStoryContext();
      const history = tracker.getHistory().slice(-10);

      return JSON.stringify(
        {
          currentStory: {
            id: currentStory.id,
            status: currentStory.status,
            startedAt: currentStory.startedAt,
            completedAt: currentStory.completedAt,
          },
          contextSummary: context,
          recentHistory: history,
          sessionId: tracker.getSessionId(),
        },
        null,
        2
      );
    },
  });
}
