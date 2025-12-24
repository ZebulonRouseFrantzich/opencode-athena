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

/**
 * Git write operations that modify repository state.
 * These require explicit user permission when autoGitOperations is disabled.
 */
const GIT_WRITE_COMMANDS = [
  "git commit",
  "git push",
  "git checkout -b",
  "git branch ",
  "git switch -c",
  "git switch --create",
  "git merge",
  "git rebase",
  "git cherry-pick",
  "git stash",
  "git tag",
  "git reset",
  "gh pr create",
  "gh pr edit",
  "gh pr merge",
  "gh pr close",
  "gh pr review",
  "gh issue create",
  "gh issue edit",
  "gh issue close",
  "gh release create",
  "gh release edit",
  "gh release delete",
];

function getBashCommand(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const cmd = (metadata as Record<string, unknown>).command;
  return typeof cmd === "string" ? cmd : "";
}

function containsGitWriteCommand(command: string): boolean {
  const normalized = command.trim().toLowerCase();

  // Split by common shell separators to check each command segment
  // This prevents false positives from strings like: echo "git commit"
  const segments = normalized.split(/[;&|]+/).map((s) => s.trim());

  return segments.some((segment) =>
    GIT_WRITE_COMMANDS.some((gitCmd) => segment.startsWith(gitCmd.toLowerCase()))
  );
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
        const command = getBashCommand(output.metadata);

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
