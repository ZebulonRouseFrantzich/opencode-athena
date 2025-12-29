import type { ParsedTask } from "../../shared/types.js";

const TASK_REGEX = /^-\s*\[([ xX])\]\s*Task\s*(\d+):\s*(.+)$/;
const SUBTASK_REGEX = /^(\s+)-\s*\[([ xX])\]\s*(\d+\.\d+):\s*(.+)$/;
const SUBTASK_ALT_REGEX = /^(\s+)-\s*\[([ xX])\]\s*(.+)$/;

export interface ParsedStory {
  storyId: string;
  title: string;
  tasks: ParsedTask[];
  acceptanceCriteriaCount: number;
  hasDevNotes: boolean;
  devNotesStartLine: number | null;
  devNotesEndLine: number | null;
  rawContent: string;
  lineCount: number;
}

function isChecked(mark: string): boolean {
  return mark.toLowerCase() === "x";
}

export function parseStoryTasks(content: string, storyId: string): ParsedStory {
  const lines = content.split("\n");
  const tasks: ParsedTask[] = [];
  let currentTask: ParsedTask | null = null;
  let subtaskCounter = 0;

  let title = "";
  const titleMatch = content.match(/^#\s+(?:Story\s+[\d.]+:\s*)?(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  let acceptanceCriteriaCount = 0;
  const acSection = content.match(/##\s*Acceptance\s*Criteria[\s\S]*?(?=##|$)/i);
  if (acSection) {
    const givenMatches = acSection[0].match(/\*\*Given\*\*/gi);
    acceptanceCriteriaCount = givenMatches ? givenMatches.length : 0;
  }

  let hasDevNotes = false;
  let devNotesStartLine: number | null = null;
  let devNotesEndLine: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (/^##\s*Dev\s*Notes/i.test(line)) {
      hasDevNotes = true;
      devNotesStartLine = lineNumber;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^##\s+/.test(lines[j]) && !/^##\s*Dev\s*Notes/i.test(lines[j])) {
          devNotesEndLine = j;
          break;
        }
      }
      if (devNotesEndLine === null) {
        devNotesEndLine = lines.length;
      }
    }

    const taskMatch = line.match(TASK_REGEX);
    if (taskMatch) {
      if (currentTask) {
        tasks.push(currentTask);
      }
      currentTask = {
        id: taskMatch[2],
        description: taskMatch[3].trim(),
        subtasks: [],
        completed: isChecked(taskMatch[1]),
        lineNumber,
      };
      subtaskCounter = 0;
      continue;
    }

    if (currentTask) {
      const subtaskMatch = line.match(SUBTASK_REGEX);
      if (subtaskMatch) {
        currentTask.subtasks.push({
          id: subtaskMatch[3],
          description: subtaskMatch[4].trim(),
          completed: isChecked(subtaskMatch[2]),
          lineNumber,
        });
        continue;
      }

      const altSubtaskMatch = line.match(SUBTASK_ALT_REGEX);
      if (altSubtaskMatch && altSubtaskMatch[1].length >= 2) {
        subtaskCounter++;
        currentTask.subtasks.push({
          id: `${currentTask.id}.${subtaskCounter}`,
          description: altSubtaskMatch[3].trim(),
          completed: isChecked(altSubtaskMatch[2]),
          lineNumber,
        });
        continue;
      }

      if (/^-\s*\[/.test(line) && !/^\s+-/.test(line)) {
        tasks.push(currentTask);
        currentTask = null;
      }
    }
  }

  if (currentTask) {
    tasks.push(currentTask);
  }

  return {
    storyId,
    title,
    tasks,
    acceptanceCriteriaCount,
    hasDevNotes,
    devNotesStartLine,
    devNotesEndLine,
    rawContent: content,
    lineCount: lines.length,
  };
}

export function extractDevNotesForTasks(content: string, taskIds: string[]): string {
  const lines = content.split("\n");
  const relevantSections: string[] = [];

  let inDevNotes = false;
  let currentSection: string[] = [];
  let currentSectionHeader = "";

  for (const line of lines) {
    if (/^##\s*Dev\s*Notes/i.test(line)) {
      inDevNotes = true;
      continue;
    }

    if (inDevNotes) {
      if (/^##\s+/.test(line) && !/^###/.test(line)) {
        inDevNotes = false;
        if (currentSection.length > 0) {
          relevantSections.push(currentSection.join("\n"));
        }
        break;
      }

      if (/^###\s+/.test(line)) {
        if (currentSection.length > 0 && shouldIncludeSection(currentSectionHeader, taskIds)) {
          relevantSections.push(currentSection.join("\n"));
        }
        currentSection = [line];
        currentSectionHeader = line;
      } else if (currentSection.length > 0 || line.trim()) {
        currentSection.push(line);
      }
    }
  }

  if (currentSection.length > 0 && shouldIncludeSection(currentSectionHeader, taskIds)) {
    relevantSections.push(currentSection.join("\n"));
  }

  const commonSections = extractCommonDevNotes(content);
  const combined = [...commonSections, ...relevantSections].filter(Boolean);

  return combined.length > 0 ? `## Dev Notes\n\n${combined.join("\n\n")}` : "";
}

function shouldIncludeSection(header: string, taskIds: string[]): boolean {
  const commonPatterns = [
    /complexity/i,
    /architecture/i,
    /technical.*requirement/i,
    /library.*framework/i,
    /file.*structure/i,
    /testing.*requirement/i,
    /previous.*story/i,
    /project.*context/i,
    /feature.*context/i,
    /reference/i,
  ];

  if (commonPatterns.some((p) => p.test(header))) {
    return true;
  }

  for (const taskId of taskIds) {
    if (header.includes(`Task ${taskId}`) || header.includes(`Task${taskId}`)) {
      return true;
    }
  }

  return false;
}

function extractCommonDevNotes(content: string): string[] {
  const sections: string[] = [];
  const lines = content.split("\n");

  let inDevNotes = false;
  let currentSection: string[] = [];
  let currentHeader = "";

  const commonHeaders = [
    /complexity.*assessment/i,
    /manual.*testing/i,
    /pre-existing.*code/i,
    /architecture.*compliance/i,
    /technical.*requirement/i,
    /library.*framework/i,
    /file.*structure/i,
    /testing.*requirement/i,
    /previous.*story/i,
    /project.*context/i,
    /feature.*context/i,
    /reference/i,
  ];

  for (const line of lines) {
    if (/^##\s*Dev\s*Notes/i.test(line)) {
      inDevNotes = true;
      continue;
    }

    if (inDevNotes) {
      if (/^##\s+/.test(line) && !/^###/.test(line)) {
        if (currentSection.length > 0 && commonHeaders.some((p) => p.test(currentHeader))) {
          sections.push(currentSection.join("\n"));
        }
        break;
      }

      if (/^###\s+/.test(line)) {
        if (currentSection.length > 0 && commonHeaders.some((p) => p.test(currentHeader))) {
          sections.push(currentSection.join("\n"));
        }
        currentSection = [line];
        currentHeader = line;
      } else if (currentSection.length > 0 || line.trim()) {
        currentSection.push(line);
      }
    }
  }

  if (currentSection.length > 0 && commonHeaders.some((p) => p.test(currentHeader))) {
    sections.push(currentSection.join("\n"));
  }

  return sections;
}

export function generateTaskSection(tasks: ParsedTask[]): string {
  const lines: string[] = ["## Tasks / Subtasks", ""];

  for (const task of tasks) {
    const checkbox = task.completed ? "[x]" : "[ ]";
    lines.push(`- ${checkbox} Task ${task.id}: ${task.description}`);

    for (const subtask of task.subtasks) {
      const subCheckbox = subtask.completed ? "[x]" : "[ ]";
      lines.push(`  - ${subCheckbox} ${subtask.id}: ${subtask.description}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}
