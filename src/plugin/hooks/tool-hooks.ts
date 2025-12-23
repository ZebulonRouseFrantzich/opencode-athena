/**
 * Tool execution hooks
 *
 * Implements safety net warnings for git operations.
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

const GIT_WRITE_COMMANDS = [
  "git commit",
  "git push",
  "git checkout -b",
  "git branch ",
  "git merge",
  "git rebase",
  "git cherry-pick",
  "git stash",
  "gh pr create",
  "gh pr edit",
  "gh pr merge",
  "gh pr close",
  "gh issue create",
  "gh release create",
];

function containsGitWriteCommand(command: string): boolean {
  const normalizedCommand = command.trim().toLowerCase();
  return GIT_WRITE_COMMANDS.some((gitCmd) => normalizedCommand.includes(gitCmd.toLowerCase()));
}

/**
 * Create tool execution hooks
 */
export function createToolHooks(_tracker: StoryTracker, config: AthenaConfig) {
  return {
    /**
     * Called before a tool executes
     */
    before: async (_input: BeforeHookInput, _output: BeforeHookOutput): Promise<void> => {
      return;
    },

    /**
     * Called after a tool executes
     */
    after: async (input: AfterHookInput, output: AfterHookOutput): Promise<void> => {
      if (config.features.autoGitOperations) {
        return;
      }

      if (input.tool === "bash") {
        const args = output.metadata as { command?: string };
        const command = args?.command || "";

        if (containsGitWriteCommand(command)) {
          output.output +=
            "\n\n⚠️ ATHENA GIT OPERATIONS POLICY REMINDER:\n" +
            "Git operations should only be performed when explicitly requested by the user.\n" +
            "If this command was run automatically (not requested by the user), please:\n" +
            "1. Ask the user before proceeding with further git operations\n" +
            "2. Use athena_update_status() to track story progress instead of git commits\n" +
            "\n" +
            "To enable automatic git operations, set features.autoGitOperations=true in athena.json";
        }
      }
    },
  };
}
