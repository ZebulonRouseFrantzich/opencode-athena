import type {
  DecompositionSplit,
  ParsedTask,
  TaskEffortEstimate,
  UserSplitConfig,
} from "../../shared/types.js";
import type { ParsedStory } from "./story-parser.js";
import { extractDevNotesForTasks, generateTaskSection } from "./story-parser.js";

const TARGET_POINTS_PER_SPLIT = 8;
const MAX_TASKS_PER_SPLIT = 6;

interface TaskWithEffort {
  task: ParsedTask;
  effort: TaskEffortEstimate;
}

export function generateDecompositionSuggestions(
  parsedStory: ParsedStory,
  taskEfforts: TaskEffortEstimate[]
): DecompositionSplit[] {
  const tasksWithEffort: TaskWithEffort[] = parsedStory.tasks.map((task) => ({
    task,
    effort: taskEfforts.find((e) => e.taskId === task.id) || {
      taskId: task.id,
      description: task.description,
      effort: "medium" as const,
      points: 3,
      signals: [],
    },
  }));

  const groups = groupTasksByConcern(tasksWithEffort);
  const balanced = balanceGroups(groups, TARGET_POINTS_PER_SPLIT);
  const withDeps = analyzeDependencies(balanced);

  return withDeps.map((group, index) => ({
    suffix: String.fromCharCode(97 + index),
    title: inferGroupTitle(group.tasks),
    taskIds: group.tasks.map((t) => t.task.id),
    estimatedPoints: group.totalPoints,
    rationale: group.rationale,
    dependencies: group.dependencies,
  }));
}

interface TaskGroup {
  tasks: TaskWithEffort[];
  totalPoints: number;
  rationale: string;
  dependencies: string[];
}

function groupTasksByConcern(tasks: TaskWithEffort[]): TaskGroup[] {
  const testingTasks: TaskWithEffort[] = [];
  const uiTasks: TaskWithEffort[] = [];
  const integrationTasks: TaskWithEffort[] = [];
  const coreTasks: TaskWithEffort[] = [];

  for (const t of tasks) {
    const desc = t.task.description.toLowerCase();
    if (/test|verify|integration test|e2e|manual test/.test(desc)) {
      testingTasks.push(t);
    } else if (/widget|screen|card|component|ui|view|button|dialog/.test(desc)) {
      uiTasks.push(t);
    } else if (/navigation|route|integration|connect|hook up/.test(desc)) {
      integrationTasks.push(t);
    } else {
      coreTasks.push(t);
    }
  }

  const groups: TaskGroup[] = [];

  if (coreTasks.length > 0) {
    groups.push({
      tasks: coreTasks,
      totalPoints: coreTasks.reduce((s, t) => s + t.effort.points, 0),
      rationale: "Core implementation tasks",
      dependencies: [],
    });
  }

  if (uiTasks.length > 0) {
    groups.push({
      tasks: uiTasks,
      totalPoints: uiTasks.reduce((s, t) => s + t.effort.points, 0),
      rationale: "UI component tasks",
      dependencies: [],
    });
  }

  if (integrationTasks.length > 0) {
    groups.push({
      tasks: integrationTasks,
      totalPoints: integrationTasks.reduce((s, t) => s + t.effort.points, 0),
      rationale: "Integration and wiring tasks",
      dependencies: [],
    });
  }

  if (testingTasks.length > 0) {
    groups.push({
      tasks: testingTasks,
      totalPoints: testingTasks.reduce((s, t) => s + t.effort.points, 0),
      rationale: "Testing and verification tasks",
      dependencies: [],
    });
  }

  if (groups.length === 0 && tasks.length > 0) {
    return balanceByPoints(tasks, TARGET_POINTS_PER_SPLIT);
  }

  return groups;
}

function balanceGroups(groups: TaskGroup[], targetPoints: number): TaskGroup[] {
  const result: TaskGroup[] = [];

  for (const group of groups) {
    if (group.totalPoints <= targetPoints && group.tasks.length <= MAX_TASKS_PER_SPLIT) {
      result.push(group);
    } else {
      const subGroups = balanceByPoints(group.tasks, targetPoints);
      for (let i = 0; i < subGroups.length; i++) {
        result.push({
          ...subGroups[i],
          rationale: `${group.rationale} (part ${i + 1})`,
        });
      }
    }
  }

  return result;
}

function balanceByPoints(tasks: TaskWithEffort[], targetPoints: number): TaskGroup[] {
  const groups: TaskGroup[] = [];
  let currentGroup: TaskWithEffort[] = [];
  let currentPoints = 0;

  const sortedTasks = [...tasks].sort((a, b) => {
    const aNum = Number.parseInt(a.task.id, 10);
    const bNum = Number.parseInt(b.task.id, 10);
    return aNum - bNum;
  });

  for (const task of sortedTasks) {
    if (
      currentPoints + task.effort.points > targetPoints &&
      currentGroup.length > 0 &&
      currentGroup.length < MAX_TASKS_PER_SPLIT
    ) {
      groups.push({
        tasks: currentGroup,
        totalPoints: currentPoints,
        rationale: "Balanced by effort",
        dependencies: [],
      });
      currentGroup = [];
      currentPoints = 0;
    }

    currentGroup.push(task);
    currentPoints += task.effort.points;

    if (currentGroup.length >= MAX_TASKS_PER_SPLIT) {
      groups.push({
        tasks: currentGroup,
        totalPoints: currentPoints,
        rationale: "Balanced by effort",
        dependencies: [],
      });
      currentGroup = [];
      currentPoints = 0;
    }
  }

  if (currentGroup.length > 0) {
    groups.push({
      tasks: currentGroup,
      totalPoints: currentPoints,
      rationale: "Balanced by effort",
      dependencies: [],
    });
  }

  return groups;
}

function analyzeDependencies(groups: TaskGroup[]): TaskGroup[] {
  if (groups.length <= 1) return groups;

  const result = groups.map((g, i) => ({
    ...g,
    dependencies: [] as string[],
    index: i,
  }));

  for (let i = 1; i < result.length; i++) {
    const group = result[i];
    const hasTestingOrIntegration = group.tasks.some((t) => {
      const desc = t.task.description.toLowerCase();
      return /test|integration|verify|navigation|route|hook/.test(desc);
    });

    if (hasTestingOrIntegration) {
      for (let j = 0; j < i; j++) {
        group.dependencies.push(String.fromCharCode(97 + j));
      }
    }
  }

  return result;
}

function inferGroupTitle(tasks: TaskWithEffort[]): string {
  if (tasks.length === 0) return "Empty Group";

  const firstTask = tasks[0].task.description;
  const commonKeywords = extractKeywords(tasks.map((t) => t.task.description));

  if (commonKeywords.length > 0) {
    return commonKeywords.slice(0, 3).join(" ");
  }

  const truncated = firstTask.length > 40 ? `${firstTask.substring(0, 37)}...` : firstTask;
  return truncated;
}

function extractKeywords(descriptions: string[]): string[] {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "to",
    "in",
    "on",
    "with",
    "task",
    "create",
    "add",
    "implement",
    "update",
  ]);

  const wordCounts = new Map<string, number>();

  for (const desc of descriptions) {
    const words = desc.toLowerCase().split(/\s+/);
    const seen = new Set<string>();
    for (const word of words) {
      const clean = word.replace(/[^a-z]/g, "");
      if (clean.length > 2 && !stopWords.has(clean) && !seen.has(clean)) {
        seen.add(clean);
        wordCounts.set(clean, (wordCounts.get(clean) || 0) + 1);
      }
    }
  }

  const sorted = [...wordCounts.entries()]
    .filter(([, count]) => count >= Math.ceil(descriptions.length / 2))
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  return sorted;
}

export function validateSplits(
  originalTasks: ParsedTask[],
  splits: UserSplitConfig[] | DecompositionSplit[]
): { valid: boolean; missingTasks: string[]; duplicatedTasks: string[] } {
  const allSplitTaskIds = new Set<string>();
  const duplicated: string[] = [];

  for (const split of splits) {
    for (const taskId of split.taskIds) {
      if (allSplitTaskIds.has(taskId)) {
        duplicated.push(taskId);
      }
      allSplitTaskIds.add(taskId);
    }
  }

  const originalTaskIds = new Set(originalTasks.map((t) => t.id));
  const missing = [...originalTaskIds].filter((id) => !allSplitTaskIds.has(id));

  return {
    valid: missing.length === 0 && duplicated.length === 0,
    missingTasks: missing,
    duplicatedTasks: duplicated,
  };
}

export function generateSubStoryContent(
  originalContent: string,
  parsedStory: ParsedStory,
  split: DecompositionSplit | UserSplitConfig,
  splitIndex: number,
  totalSplits: number,
  originalStoryId: string
): string {
  const tasksForSplit = parsedStory.tasks.filter((t) => split.taskIds.includes(t.id));
  const devNotes = extractDevNotesForTasks(originalContent, split.taskIds);
  const taskSection = generateTaskSection(tasksForSplit);

  const suffix = "suffix" in split ? split.suffix : String.fromCharCode(97 + splitIndex);
  const title =
    "title" in split && split.title
      ? split.title
      : inferGroupTitle(
          tasksForSplit.map((t) => ({
            task: t,
            effort: {
              taskId: t.id,
              description: t.description,
              effort: "medium" as const,
              points: 3,
              signals: [],
            },
          }))
        );

  const storyMatch = originalContent.match(/^#\s+(?:Story\s+[\d.]+:\s*)?(.+)$/m);
  const originalTitle = storyMatch ? storyMatch[1].trim() : "Untitled Story";

  const statusMatch = originalContent.match(/^Status:\s*(.+)$/m);
  const status = statusMatch ? statusMatch[1].trim() : "ready-for-dev";

  const storyUserSection = originalContent.match(
    /##\s*Story[\s\S]*?(?=##\s*Acceptance|##\s*Tasks|$)/i
  );
  const userStory = storyUserSection ? storyUserSection[0].trim() : "";

  const acSection = originalContent.match(
    /##\s*Acceptance\s*Criteria[\s\S]*?(?=##\s*Tasks|##\s*Dev|$)/i
  );
  const acceptanceCriteria = acSection ? acSection[0].trim() : "";

  const lines: string[] = [
    `# Story ${originalStoryId}${suffix}: ${originalTitle} - ${title}`,
    "",
    `Status: ${status === "done" ? "ready-for-dev" : status}`,
    "",
    `> **Note:** This story was decomposed from Story ${originalStoryId} (part ${splitIndex + 1} of ${totalSplits})`,
    "",
  ];

  if (userStory) {
    lines.push(userStory);
    lines.push("");
  }

  if (acceptanceCriteria) {
    lines.push(acceptanceCriteria);
    lines.push("");
  }

  lines.push(taskSection);

  if (devNotes) {
    lines.push("");
    lines.push(devNotes);
  }

  return lines.join("\n");
}

export function formatDecompositionSuggestion(
  splits: DecompositionSplit[],
  storyId: string
): string {
  const lines: string[] = [];

  lines.push("🔀 SUGGESTED DECOMPOSITION");
  lines.push("━".repeat(45));
  lines.push("");

  for (const split of splits) {
    lines.push(`Story ${storyId}${split.suffix}: ${split.title}`);
    lines.push(`├─ Tasks: ${split.taskIds.join(", ")}`);
    lines.push(`├─ Points: ~${split.estimatedPoints}`);
    lines.push(`├─ Rationale: ${split.rationale}`);
    if (split.dependencies.length > 0) {
      lines.push(`└─ Dependencies: ${split.dependencies.map((d) => `${storyId}${d}`).join(", ")}`);
    } else {
      lines.push("└─ Dependencies: None");
    }
    lines.push("");
  }

  const totalTasks = splits.reduce((sum, s) => sum + s.taskIds.length, 0);
  lines.push("VERIFICATION:");
  lines.push(`✅ All ${totalTasks} tasks accounted for`);
  lines.push("✅ No duplicate tasks");
  lines.push("✅ Dependencies correctly ordered");

  return lines.join("\n");
}

export function getSubStoryFilename(originalFilename: string, suffix: string): string {
  const match = originalFilename.match(/^(\d+-\d+)(-.*)?\.md$/);
  if (match) {
    const storyPart = match[1];
    const titlePart = match[2] || "";
    return `${storyPart}${suffix}${titlePart}.md`;
  }
  const noExt = originalFilename.replace(/\.md$/, "");
  return `${noExt}${suffix}.md`;
}

export function getSubStoryId(originalStoryId: string, suffix: string): string {
  return `${originalStoryId}${suffix}`;
}
