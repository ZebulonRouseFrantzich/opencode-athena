import type { AthenaConfig, OpenCodeTodo } from "../../shared/types.js";
import { TODO_MATCH_THRESHOLDS } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import { createPluginLogger } from "../utils/plugin-logger.js";
import { findStoryFile } from "../utils/story-loader.js";
import {
  bmadTasksToTodos,
  extractStoryIdFromContent,
  findCheckboxLine,
  findMatchingTodo,
  isBmadTodo,
  mergeTodos,
  parseBmadTasks,
  parseTodoId,
  updateBmadCheckbox,
} from "../utils/todo-sync.js";

const log = createPluginLogger("todo-hooks");

export interface TodoSyncPaths {
  storiesDir: string;
}

export interface StoryLoadedResult {
  mergedTodos: OpenCodeTodo[];
  newBmadTodos: OpenCodeTodo[];
}

export async function onStoryLoaded(
  tracker: StoryTracker,
  config: AthenaConfig,
  storyId: string,
  storyContent: string
): Promise<StoryLoadedResult> {
  if (!config.features.todoSync) {
    return { mergedTodos: [], newBmadTodos: [] };
  }

  try {
    const tasks = parseBmadTasks(storyContent, storyId);
    const newBmadTodos = bmadTasksToTodos(tasks);

    const existingTodos = tracker.getCurrentTodos() || [];
    const mergedTodos = mergeTodos(existingTodos, newBmadTodos, storyId);

    await tracker.setCurrentTodos(mergedTodos);

    log.info("Synced BMAD tasks to todos", {
      storyId,
      newTasks: tasks.length,
      totalTodos: mergedTodos.length,
    });

    return { mergedTodos, newBmadTodos };
  } catch (error) {
    log.warn("Failed to sync BMAD tasks", { storyId, error });
    return { mergedTodos: [], newBmadTodos: [] };
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
  log.debug("Processing todowrite for BMAD sync", {
    incomingTodos: todos.length,
    trackedTodos: previousTodos.length,
  });

  let processed = 0;
  let matchedById = 0;
  let matchedByContent = 0;
  let lowConfidenceSkipped = 0;
  let updated = 0;

  for (const todo of todos) {
    const matchResult = findMatchingTodo(todo, previousTodos);

    if (matchResult.matchType === "none" || !matchResult.matched) {
      if (isBmadTodo(todo)) {
        log.debug("No match found for BMAD-formatted todo", {
          todoId: todo.id,
          content: todo.content.slice(0, 50),
        });
      }
      continue;
    }

    processed++;
    const previous = matchResult.matched;

    if (matchResult.matchType === "id") {
      matchedById++;
    } else {
      matchedByContent++;
      log.debug("Matched todo by content", {
        matchType: matchResult.matchType,
        confidence: `${Math.round(matchResult.confidence * 100)}%`,
        incomingContent: todo.content.slice(0, 40),
        matchedContent: previous.content.slice(0, 40),
      });
    }

    if (
      matchResult.matchType === "similar-content" &&
      matchResult.confidence < TODO_MATCH_THRESHOLDS.AUTO_UPDATE
    ) {
      lowConfidenceSkipped++;
      log.info("Low-confidence match skipped (requires explicit completion)", {
        confidence: `${Math.round(matchResult.confidence * 100)}%`,
        threshold: `${Math.round(TODO_MATCH_THRESHOLDS.AUTO_UPDATE * 100)}%`,
        todoContent: todo.content.slice(0, 50),
        possibleMatch: previous.content.slice(0, 50),
      });
      continue;
    }

    const statusChanged = previous.status !== todo.status;
    if (!statusChanged) {
      continue;
    }

    log.debug("Todo status changed", {
      matchType: matchResult.matchType,
      from: previous.status,
      to: todo.status,
    });

    const storyId = extractStoryIdFromContent(previous.content);
    const parsed = parseTodoId(previous.id);

    if (!storyId && !parsed) {
      log.debug("Could not determine story ID from matched todo", {
        todoId: previous.id,
        content: previous.content.slice(0, 50),
      });
      continue;
    }

    const targetStoryId = storyId || parsed?.storyId;
    const lineHint = parsed?.lineHint ?? 0;

    if (!targetStoryId) {
      log.warn("No story ID found for BMAD todo", {
        todoId: previous.id,
        content: previous.content,
      });
      continue;
    }

    try {
      const storyFile = await findStoryFile(paths.storiesDir, targetStoryId);
      if (!storyFile) {
        log.warn("Story file not found for BMAD todo", {
          storyId: targetStoryId,
          storiesDir: paths.storiesDir,
        });
        continue;
      }

      const lineNumber = await findCheckboxLine(storyFile.path, previous.content, lineHint);

      if (lineNumber === null) {
        log.warn("Checkbox not found in BMAD file", {
          storyPath: storyFile.path,
          content: previous.content.slice(0, 50),
          lineHint,
        });
        continue;
      }

      const checked = todo.status === "completed";
      const wasUpdated = await updateBmadCheckbox(storyFile.path, lineNumber, checked);

      if (wasUpdated) {
        updated++;
        log.info("Updated BMAD checkbox", {
          storyId: targetStoryId,
          line: lineNumber,
          checked,
          matchType: matchResult.matchType,
          content: previous.content.slice(0, 50),
        });
      } else {
        log.warn("Failed to update checkbox", {
          storyId: targetStoryId,
          line: lineNumber,
        });
      }
    } catch (error) {
      log.warn("Error updating BMAD checkbox", {
        storyId: targetStoryId,
        error: String(error),
      });
    }
  }

  log.debug("BMAD sync complete", {
    processed,
    matchedById,
    matchedByContent,
    lowConfidenceSkipped,
    checkboxesUpdated: updated,
  });

  await tracker.setCurrentTodos(todos);
}
