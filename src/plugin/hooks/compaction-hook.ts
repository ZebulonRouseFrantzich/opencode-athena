import type { StoryTracker } from "../tracker/story-tracker.js";
import { isBmadTodo } from "../utils/todo-sync.js";

interface CompactionInput {
  sessionID: string;
}

interface CompactionOutput {
  context: string[];
}

export function createCompactionHook(tracker: StoryTracker) {
  return async (_input: CompactionInput, output: CompactionOutput): Promise<void> => {
    const storyContext = await tracker.getCurrentStoryContext();
    const todos = tracker.getCurrentTodos();
    const currentStory = tracker.getCurrentStory();

    const parts: string[] = [];

    if (storyContext) {
      parts.push("## OpenCode Athena - Current BMAD Story Context");
      parts.push("");
      parts.push(storyContext);
      if (currentStory) {
        const storyFileName = `story-${currentStory.id.replace(".", "-")}.md`;
        parts.push(`**File:** docs/stories/${storyFileName}`);
      }
      parts.push("");
    }

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
          parts.push(`Read docs/stories/${storyFileName}`);
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
