/**
 * Tool execution hooks (STUB)
 *
 * TODO: Potential use cases for tool hooks in Athena:
 *
 * 1. Auto-status on test pass:
 *    - After Bash tool runs tests successfully
 *    - Prompt to mark story as completed
 *
 * 2. Context injection on file read:
 *    - When reading story files
 *    - Inject implementation instructions
 *
 * 3. BMAD file protection:
 *    - Before Write/Edit on _bmad/ files
 *    - Warn or block direct modifications
 *
 * 4. Story progress tracking:
 *    - Track which files are modified during story implementation
 *    - Generate change summary for completion
 *
 * See oh-my-opencode for examples:
 * - comment-checker: Checks for excessive comments after Write/Edit
 * - tool-output-truncator: Truncates large outputs
 * - agent-usage-reminder: Reminds to use specialized agents
 */

import type { AthenaConfig } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";

interface BeforeHookInput {
  tool: string;
  sessionID: string;
  callID: string;
}

interface BeforeHookOutput {
  args: unknown;
}

interface AfterHookInput {
  tool: string;
  sessionID: string;
  callID: string;
}

interface AfterHookOutput {
  title: string;
  output: string;
  metadata: unknown;
}

/**
 * Create tool execution hooks
 *
 * Currently returns stubs. See TODO comments for future implementation ideas.
 */
export function createToolHooks(_tracker: StoryTracker, _config: AthenaConfig) {
  return {
    /**
     * Called before a tool executes
     * Can modify args or throw to block execution
     */
    before: async (_input: BeforeHookInput, _output: BeforeHookOutput): Promise<void> => {
      // TODO: Implement tool.execute.before hooks
      // Currently a no-op stub
    },

    /**
     * Called after a tool executes
     * Can modify output or append messages
     */
    after: async (_input: AfterHookInput, _output: AfterHookOutput): Promise<void> => {
      // TODO: Implement tool.execute.after hooks
      // Currently a no-op stub
    },
  };
}
