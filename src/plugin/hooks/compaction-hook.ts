import type { AthenaConfig } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import { isBmadTodo } from "../utils/todo-sync.js";

interface CompactionInput {
  sessionID: string;
}

interface CompactionOutput {
  context: string[];
}

export function createCompactionHook(tracker: StoryTracker, config: AthenaConfig) {
  const storiesPath = config.bmad?.paths?.stories ?? "docs/stories";

  return async (_input: CompactionInput, output: CompactionOutput): Promise<void> => {
    const storyContext = await tracker.getCurrentStoryContext();
    const todos = tracker.getCurrentTodos();
    const currentStory = tracker.getCurrentStory();

    const parts: string[] = [];

    if (todos && todos.length > 0) {
      const bmadTodos = todos.filter((t) => isBmadTodo(t));
      const pending = bmadTodos.filter((t) => t.status === "pending");
      const inProgress = bmadTodos.filter((t) => t.status === "in_progress");
      const completed = bmadTodos.filter((t) => t.status === "completed");

      if (bmadTodos.length > 0 && (pending.length > 0 || inProgress.length > 0)) {
        parts.push("## ⚠️ MANDATORY POST-COMPACTION PROTOCOL");
        parts.push("");
        parts.push("**STOP. Before doing ANYTHING else:**");
        parts.push("1. Call `todoread` to get your current task list");
        parts.push("2. Review the todos below and compare to any 'next steps' you see");
        parts.push("3. If any todo is marked `in_progress`, complete it FIRST");
        parts.push("4. The TODO LIST is your source of truth, not the compaction summary");
        parts.push("");

        if (inProgress.length > 0) {
          parts.push("### 🔄 IN PROGRESS (Complete these FIRST):");
          for (const todo of inProgress) {
            parts.push(`- ${todo.content}`);
          }
          parts.push("");
        }

        if (pending.length > 0) {
          parts.push("### ⏳ PENDING (Work queue):");
          const sortedPending = pending.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          });

          const todosToShow = sortedPending.slice(0, 10);
          for (const todo of todosToShow) {
            const icon = todo.priority === "high" ? "🔴" : todo.priority === "medium" ? "🟡" : "🟢";
            parts.push(`${icon} ${todo.content}`);
          }

          if (pending.length > 10) {
            parts.push(`   ... and ${pending.length - 10} more (call todoread for full list)`);
          }
          parts.push("");
        }

        parts.push("### ✅ VERIFICATION REQUIRED");
        parts.push("Call `todoread` NOW to confirm this matches your working state.");
        parts.push(
          "If it doesn't match, the todo list takes priority over any 'next steps' in this summary."
        );
        parts.push("");
        parts.push("---");
        parts.push("");
      }
    }

    if (storyContext) {
      parts.push("## OpenCode Athena - Current BMAD Story Context");
      parts.push("");
      parts.push(storyContext);
      if (currentStory) {
        const storyFileName = `story-${currentStory.id.replace(".", "-")}.md`;
        parts.push(`**File:** ${storiesPath}/${storyFileName}`);
      }
      parts.push("");
    }

    if (todos && todos.length > 0) {
      const bmadTodos = todos.filter((t) => isBmadTodo(t));
      const pending = bmadTodos.filter((t) => t.status === "pending");
      const inProgress = bmadTodos.filter((t) => t.status === "in_progress");
      const completed = bmadTodos.filter((t) => t.status === "completed");

      if (bmadTodos.length > 0 && (pending.length > 0 || inProgress.length > 0)) {
        parts.push("## ⚠️ MANDATORY POST-COMPACTION PROTOCOL");
        parts.push("");
        parts.push("**STOP. Before doing ANYTHING else:**");
        parts.push("1. Call `todoread` to get your current task list");
        parts.push("2. Review the todos below and compare to any 'next steps' you see");
        parts.push("3. If any todo is marked `in_progress`, complete it FIRST");
        parts.push("4. The TODO LIST is your source of truth, not the compaction summary");
        parts.push("");

        // Show in-progress todos with prominent warning
        if (inProgress.length > 0) {
          parts.push("### 🔄 IN PROGRESS (Complete these FIRST):");
          for (const todo of inProgress) {
            parts.push(`- ${todo.content}`);
          }
          parts.push("");
        }

        // Show pending todos (top 10 by priority)
        if (pending.length > 0) {
          parts.push("### ⏳ PENDING (Work queue):");
          const sortedPending = pending.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          });

          const todosToShow = sortedPending.slice(0, 10);
          for (const todo of todosToShow) {
            const icon = todo.priority === "high" ? "🔴" : todo.priority === "medium" ? "🟡" : "🟢";
            parts.push(`${icon} ${todo.content}`);
          }

          if (pending.length > 10) {
            parts.push(`   ... and ${pending.length - 10} more (call todoread for full list)`);
          }
          parts.push("");
        }

        // Verification step
        parts.push("### ✅ VERIFICATION REQUIRED");
        parts.push("Call `todoread` NOW to confirm this matches your working state.");
        parts.push(
          "If it doesn't match, the todo list takes priority over any 'next steps' in this summary."
        );
        parts.push("");
        parts.push("---");
        parts.push("");
      }
    }

    // STORY CONTEXT (comes after todo protocol)
    if (storyContext) {
      parts.push("## OpenCode Athena - Current BMAD Story Context");
      parts.push("");
      parts.push(storyContext);
      if (currentStory) {
        const storyFileName = `story-${currentStory.id.replace(".", "-")}.md`;
        parts.push(`**File:** ${storiesPath}/${storyFileName}`);
      }
      parts.push("");
    }

    // TODO SYNC DOCUMENTATION (how it works)
    if (todos && todos.length > 0) {
      const bmadTodos = todos.filter((t) => isBmadTodo(t));
      const pending = bmadTodos.filter((t) => t.status === "pending").length;
      const inProgress = bmadTodos.filter((t) => t.status === "in_progress").length;
      const completed = bmadTodos.filter((t) => t.status === "completed").length;

      if (bmadTodos.length > 0) {
        parts.push("## Todo Sync (BMAD ↔ Todos)");
        parts.push("");
        parts.push(`**Progress:** ${completed}/${bmadTodos.length} BMAD tasks complete`);
        parts.push(`**Remaining:** ${pending} pending, ${inProgress} in progress`);
        parts.push("");
        parts.push("**How todos work:**");
        parts.push("- Format: `[{storyId}Δ{section}] {task}`");
        parts.push("- Marking a todo complete updates the BMAD file automatically");
        parts.push("- For task details, read the story file");
        parts.push("");
        if (currentStory) {
          const storyFileName = `story-${currentStory.id.replace(".", "-")}.md`;
          parts.push("**To look up task context:**");
          parts.push("```");
          parts.push(`Read ${storiesPath}/${storyFileName}`);
          parts.push("```");
          parts.push("");
        }
      }
    }

    if (storyContext || (todos && todos.length > 0)) {
      parts.push(
        "IMPORTANT: You are implementing a BMAD story. Use athena_get_story to reload full context if needed. Use athena_update_status to update the story status when complete."
      );
      parts.push("");

      output.context.push(parts.join("\n"));
    }
  };
}
