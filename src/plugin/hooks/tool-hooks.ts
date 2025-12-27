/**
 * Tool execution hooks
 *
 * Implements safety net warnings for git operations and BMAD todo synchronization.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { AthenaConfig, OpenCodeTodo } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import { getBmadPaths } from "../utils/bmad-finder.js";
import { createPluginLogger } from "../utils/plugin-logger.js";
import { onStoryLoaded, onTodoWritten } from "./todo-hooks.js";

const log = createPluginLogger("tool-hooks");

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

export function createToolHooks(ctx: PluginInput, tracker: StoryTracker, config: AthenaConfig) {
  return {
    before: async (_input: BeforeHookInput, _output: BeforeHookOutput): Promise<void> => {
      return;
    },

    after: async (input: AfterHookInput, output: AfterHookOutput): Promise<void> => {
      if (!config.features.autoGitOperations && input.tool === "bash") {
        const command = getBashCommand(output.metadata);

        if (containsGitWriteCommand(command)) {
          log.warn("Git write operation detected", { command: command.slice(0, 100) });
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

      if (input.tool === "athena_get_story" && config.features.todoSync) {
        await handleStoryLoaded(ctx, tracker, config, output);
      }

      if (input.tool === "todowrite" && config.features.todoSync) {
        await handleTodoWritten(ctx, tracker, config, output);
      }
    },
  };
}

async function handleStoryLoaded(
  _ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig,
  output: AfterHookOutput
): Promise<void> {
  try {
    const result = JSON.parse(output.output);
    if (!result.storyId || !result.story) return;

    const { mergedTodos, newBmadTodos } = await onStoryLoaded(
      tracker,
      config,
      result.storyId,
      result.story
    );

    if (mergedTodos.length > 0) {
      result.todos = {
        hint: "Call todowrite with these todos to populate your task list. Marking todos complete updates BMAD checkboxes automatically.",
        items: newBmadTodos,
      };
      output.output = JSON.stringify(result, null, 2);

      log.debug("Injected todo hint into athena_get_story response", {
        storyId: result.storyId,
        todoCount: newBmadTodos.length,
      });
    }
  } catch (error) {
    log.debug("Could not parse athena_get_story output for todo sync", { error });
  }
}

async function handleTodoWritten(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig,
  output: AfterHookOutput
): Promise<void> {
  try {
    const result = JSON.parse(output.output);
    if (!result) return;

    // Handle both { todos: [...] } object shape and raw array shape
    const todos: OpenCodeTodo[] | undefined = Array.isArray(result)
      ? result
      : Array.isArray(result.todos)
        ? result.todos
        : undefined;

    if (!todos) return;
    const paths = await getBmadPaths(ctx.directory, config);

    await onTodoWritten(tracker, config, { storiesDir: paths.storiesDir }, todos);
  } catch (error) {
    log.debug("Could not parse todowrite output for BMAD sync", { error });
  }
}
