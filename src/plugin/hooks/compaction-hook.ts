/**
 * Session compaction hook
 *
 * Preserves BMAD story context when the session is compacted.
 */

import type { StoryTracker } from "../tracker/story-tracker.js";

interface CompactionInput {
  sessionID: string;
}

interface CompactionOutput {
  context: string[];
}

/**
 * Create the compaction hook
 *
 * This hook is called before session compaction starts.
 * It injects the current BMAD story context into the compaction prompt
 * so the agent retains awareness of the story being implemented.
 */
export function createCompactionHook(tracker: StoryTracker) {
  return async (_input: CompactionInput, output: CompactionOutput): Promise<void> => {
    const storyContext = await tracker.getCurrentStoryContext();

    if (storyContext) {
      output.context.push(`## OpenCode Athena - Current BMAD Story Context

${storyContext}

IMPORTANT: You are implementing a BMAD story. Use athena_get_story to reload full context if needed. Use athena_update_status to update the story status when complete.
`);
    }
  };
}
