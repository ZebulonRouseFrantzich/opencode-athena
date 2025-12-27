import { readFile, writeFile } from "node:fs/promises";
import type {
  BmadSection,
  BmadTask,
  OpenCodeTodo,
  ParsedTodoId,
  TodoPriority,
  TodoStatus,
} from "../../shared/types.js";

export const ATHENA_SEPARATOR = "Δ";

const BMAD_TODO_PATTERN = /^\s*\[[\d.]+Δ/;

const CHECKBOX_PATTERN = /^(\s*)- \[([ xX])\] (.+)$/;

const SECTION_HEADERS: Record<string, BmadSection> = {
  "acceptance criteria": "ac",
  "tasks / subtasks": "tasks",
  "tasks/subtasks": "tasks",
  tasks: "tasks",
  subtasks: "tasks",
  "implementation notes": "impl-notes",
};

const SECTION_LABELS: Record<BmadSection, string> = {
  ac: "AC",
  tasks: "Task",
  "impl-notes": "Fix",
};

export function parseBmadTasks(content: string, storyId: string): BmadTask[] {
  const lines = content.split("\n");
  const tasks: BmadTask[] = [];

  let currentSection: BmadSection | null = null;
  let sectionIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      const headerText = headerMatch[1].trim().toLowerCase();
      const matchedSection = Object.entries(SECTION_HEADERS).find(([key]) =>
        headerText.startsWith(key)
      );

      if (matchedSection) {
        currentSection = matchedSection[1];
        sectionIndex = 0;
      } else {
        currentSection = null;
      }
      continue;
    }

    if (!currentSection) continue;

    const checkboxMatch = line.match(CHECKBOX_PATTERN);
    if (!checkboxMatch) continue;

    sectionIndex++;
    const [, indent, checkState, taskText] = checkboxMatch;
    const checked = checkState.toLowerCase() === "x";
    const priority = detectPriority(taskText, currentSection);

    tasks.push({
      id: `${storyId}:${currentSection}:${i}`,
      storyId,
      section: currentSection,
      sectionIndex,
      lineNumber: i,
      content: taskText.trim(),
      checked,
      priority,
      indent: indent.length,
    });
  }

  return tasks;
}

function detectPriority(content: string, section: BmadSection): TodoPriority {
  const lower = content.toLowerCase();

  if (lower.includes("priority: critical") || lower.includes("critical:")) {
    return "high";
  }
  if (lower.includes("priority: high")) {
    return "high";
  }
  if (lower.includes("priority: medium")) {
    return "medium";
  }
  if (lower.includes("priority: low")) {
    return "low";
  }

  switch (section) {
    case "ac":
      return "high";
    case "tasks":
      return "medium";
    case "impl-notes":
      return "medium";
  }
}

export function bmadTasksToTodos(tasks: BmadTask[]): OpenCodeTodo[] {
  return tasks.map((task) => {
    const label = SECTION_LABELS[task.section];
    const prefix = `[${task.storyId}${ATHENA_SEPARATOR}${label}${task.sectionIndex}]`;
    const indentation = " ".repeat(task.indent);
    const status: TodoStatus = task.checked ? "completed" : "pending";

    return {
      id: task.id,
      content: `${indentation}${prefix} ${task.content}`,
      status,
      priority: task.priority,
    };
  });
}

export function parseTodoId(todoId: string): ParsedTodoId | null {
  const parts = todoId.split(":");
  if (parts.length !== 3) return null;

  const [storyId, section, lineStr] = parts;
  const lineHint = Number.parseInt(lineStr, 10);

  if (!storyId || !section || Number.isNaN(lineHint)) return null;

  const validSections: BmadSection[] = ["ac", "tasks", "impl-notes"];
  if (!validSections.includes(section as BmadSection)) return null;

  return {
    storyId,
    section: section as BmadSection,
    lineHint,
  };
}

export function isBmadTodo(todo: OpenCodeTodo): boolean {
  return BMAD_TODO_PATTERN.test(todo.content);
}

export function extractStoryIdFromContent(content: string): string | null {
  const match = content.match(/^\s*\[([\d.]+)Δ/);
  return match ? match[1] : null;
}

export async function findCheckboxLine(
  storyPath: string,
  taskContent: string,
  lineHint: number
): Promise<number | null> {
  const content = await readFile(storyPath, "utf-8");
  const lines = content.split("\n");

  const searchText = extractTaskText(taskContent);
  if (!searchText) return null;

  if (lineHint >= 0 && lineHint < lines.length) {
    if (matchesCheckbox(lines[lineHint], searchText)) {
      return lineHint;
    }
  }

  const searchRadius = 15;
  const startNearby = Math.max(0, lineHint - searchRadius);
  const endNearby = Math.min(lines.length, lineHint + searchRadius + 1);

  for (let i = startNearby; i < endNearby; i++) {
    if (i === lineHint) continue;
    if (matchesCheckbox(lines[i], searchText)) {
      return i;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (i >= startNearby && i < endNearby) continue;
    if (matchesCheckbox(lines[i], searchText)) {
      return i;
    }
  }

  return null;
}

function extractTaskText(todoContent: string): string | null {
  const match = todoContent.match(/^\s*\[[\d.]+Δ\w+\d*\]\s*(.+)$/);
  return match ? match[1].trim() : todoContent.trim();
}

function matchesCheckbox(line: string, searchText: string): boolean {
  const checkboxMatch = line.match(CHECKBOX_PATTERN);
  if (!checkboxMatch) return false;

  const checkboxText = checkboxMatch[3].trim().toLowerCase();
  const search = searchText.toLowerCase();

  if (checkboxText === search) return true;
  if (checkboxText.includes(search) || search.includes(checkboxText)) return true;

  const similarity = calculateSimilarity(checkboxText, search);
  return similarity > 0.7;
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export async function updateBmadCheckbox(
  storyPath: string,
  lineNumber: number,
  checked: boolean
): Promise<boolean> {
  const content = await readFile(storyPath, "utf-8");
  const lines = content.split("\n");

  if (lineNumber < 0 || lineNumber >= lines.length) {
    return false;
  }

  const line = lines[lineNumber];
  const checkboxMatch = line.match(CHECKBOX_PATTERN);

  if (!checkboxMatch) {
    return false;
  }

  if (checked) {
    lines[lineNumber] = line.replace("- [ ]", "- [x]");
  } else {
    lines[lineNumber] = line.replace(/- \[[xX]\]/, "- [ ]");
  }

  await writeFile(storyPath, lines.join("\n"), "utf-8");
  return true;
}

export function mergeTodos(
  existingTodos: OpenCodeTodo[],
  newBmadTodos: OpenCodeTodo[],
  loadingStoryId: string
): OpenCodeTodo[] {
  const userTodos = existingTodos.filter((t) => !isBmadTodo(t));

  const otherStoryTodos = existingTodos.filter((t) => {
    if (!isBmadTodo(t)) return false;
    const todoStoryId = extractStoryIdFromContent(t.content);
    return todoStoryId !== loadingStoryId && t.status !== "completed";
  });

  return [...userTodos, ...otherStoryTodos, ...newBmadTodos];
}
