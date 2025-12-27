import type { AthenaConfig } from "../../shared/types.js";
import type { OpenCodeTodo } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import {
  parseBmadTasks,
  bmadTasksToTodos,
  parseTodoId,
  isBmadTodo,
  findCheckboxLine,
  updateBmadCheckbox,
  mergeTodos,
} from "../utils/todo-sync.js";
import { findStoryFile } from "../utils/story-loader.js";
import { createPluginLogger } from "../utils/plugin-logger.js";

const log = createPluginLogger("todo-hooks");

export interface TodoSyncPaths {
  storiesDir: string;
}

export async function onStoryLoaded(
  tracker: StoryTracker,
  config: AthenaConfig,
  storyId: string,
  storyContent: string
): Promise<OpenCodeTodo[]> {
  if (!config.features.todoSync) {
    return [];
  }

  try {
    const tasks = parseBmadTasks(storyContent, storyId);
    const newBmadTodos = bmadTasksToTodos(tasks);

    const existingTodos = tracker.getCurrentTodos() || [];
    const mergedTodos = mergeTodos(existingTodos, newBmadTodos, storyId);

    tracker.setCurrentTodos(mergedTodos);

    log.info("Synced BMAD tasks to todos", {
      storyId,
      newTasks: tasks.length,
      totalTodos: mergedTodos.length,
    });

    return mergedTodos;
  } catch (error) {
    log.warn("Failed to sync BMAD tasks", { storyId, error });
    return [];
  }
}

export async function onTodoWritten(
  tracker: StoryTracker,
  config: AthenaConfig,
  paths: TodoSyncPaths,
  todos: OpenCodeTodo[]
): Promise<void> {
  if (!config.features.todoSync) {
    return;
  }

  const previousTodos = tracker.getCurrentTodos() || [];

  for (const todo of todos) {
    if (!isBmadTodo(todo)) continue;

    const previous = previousTodos.find((t: OpenCodeTodo) => t.id === todo.id);
    if (!previous) continue;

    const statusChanged = previous.status !== todo.status;
    if (!statusChanged) continue;

    const parsed = parseTodoId(todo.id);
    if (!parsed) continue;

    try {
      const storyFile = await findStoryFile(paths.storiesDir, parsed.storyId);
      if (!storyFile) {
        log.warn("Story file not found for BMAD todo", { todoId: todo.id });
        continue;
      }

      const lineNumber = await findCheckboxLine(storyFile.path, todo.content, parsed.lineHint);

      if (lineNumber === null) {
        log.warn("Checkbox not found in BMAD file", {
          todoId: todo.id,
          storyPath: storyFile.path,
        });
        continue;
      }

      const checked = todo.status === "completed";
      const updated = await updateBmadCheckbox(storyFile.path, lineNumber, checked);

      if (updated) {
        log.info("Updated BMAD checkbox", {
          storyId: parsed.storyId,
          line: lineNumber,
          checked,
        });
      }
    } catch (error) {
      log.warn("Failed to update BMAD checkbox", { todoId: todo.id, error });
    }
  }

  tracker.setCurrentTodos(todos);
}
