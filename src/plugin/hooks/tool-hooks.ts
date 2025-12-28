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
        await handleStoryLoaded(ctx, tracker, config, input.sessionID, output);
      }

      if (input.tool === "todowrite" && config.features.todoSync) {
        await handleTodoWritten(ctx, tracker, config, output);
      }
    },
  };
}

async function handleStoryLoaded(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig,
  sessionID: string,
  output: AfterHookOutput
): Promise<void> {
  try {
    const result = JSON.parse(output.output);
    if (!result.storyId || !result.story) {
      log.debug("Story load response missing storyId or story content");
      return;
    }

    log.debug("Processing story load for todo sync", { storyId: result.storyId });

    const { newBmadTodos, mergedTodos } = await onStoryLoaded(
      tracker,
      config,
      result.storyId,
      result.story
    );

    if (newBmadTodos.length > 0) {
      result.todos = {
        hint: "Call todowrite with these todos to populate your task list. Marking todos complete updates BMAD checkboxes automatically.",
        items: newBmadTodos,
      };
      output.output = JSON.stringify(result, null, 2);

      log.debug("Injected BMAD todos into story response", {
        storyId: result.storyId,
        newTodos: newBmadTodos.length,
        totalTracked: mergedTodos.length,
      });

      await autoInjectTodos(ctx, sessionID, newBmadTodos);
    } else {
      log.debug("No BMAD todos found in story", { storyId: result.storyId });
    }
  } catch (error) {
    log.warn("Failed to process story for todo sync", { error: String(error) });
  }
}

async function autoInjectTodos(
  ctx: PluginInput,
  sessionID: string,
  todos: OpenCodeTodo[]
): Promise<void> {
  const client = ctx.client as unknown as Record<string, unknown> | undefined;
  const session = client?.session as Record<string, unknown> | undefined;
  const updateFn = session?.update as ((args: unknown) => Promise<unknown>) | undefined;

  if (!updateFn) {
    log.debug("OpenCode client session.update API not available");
    return;
  }

  try {
    await updateFn({
      path: { id: sessionID },
      body: {
        update: {
          sessionUpdate: "plan",
          entries: todos.map((todo) => ({
            priority: todo.priority || "medium",
            status: todo.status === "cancelled" ? "completed" : todo.status,
            content: todo.content,
          })),
        },
      },
    });

    log.debug("Auto-injected BMAD todos via OpenCode API", { count: todos.length });
  } catch (error) {
    log.debug("Could not auto-inject todos (API call failed)", {
      error: String(error),
    });
  }
}

async function handleTodoWritten(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig,
  output: AfterHookOutput
): Promise<void> {
  const todos = extractTodosFromOutput(output);

  if (!todos || todos.length === 0) {
    log.debug("No todos found in todowrite output");
    return;
  }

  try {
    const paths = await getBmadPaths(ctx.directory, config);
    await onTodoWritten(tracker, config, { storiesDir: paths.storiesDir }, todos);
  } catch (error) {
    log.warn("Error processing todowrite for BMAD sync", { error: String(error) });
  }
}

function extractTodosFromOutput(output: AfterHookOutput): OpenCodeTodo[] | null {
  const metadata = output.metadata as Record<string, unknown> | undefined;
  if (metadata?.todos && Array.isArray(metadata.todos)) {
    log.debug("Extracted todos from metadata", { count: metadata.todos.length });
    return metadata.todos as OpenCodeTodo[];
  }

  try {
    const result = JSON.parse(output.output);
    if (Array.isArray(result)) {
      log.debug("Extracted todos from output (array)", { count: result.length });
      return result as OpenCodeTodo[];
    }
    if (result?.todos && Array.isArray(result.todos)) {
      log.debug("Extracted todos from output.todos", { count: result.todos.length });
      return result.todos as OpenCodeTodo[];
    }
  } catch {
    log.debug("Could not parse output as JSON");
  }

  return null;
}
