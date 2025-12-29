import type {
  ComplexityRecommendation,
  ComplexityThresholds,
  ParsedTask,
  StoryComplexityAssessment,
  StoryMetrics,
  TaskEffortEstimate,
  TaskEffortLevel,
} from "../../shared/types.js";
import { DEFAULT_COMPLEXITY_THRESHOLDS } from "../../shared/types.js";
import type { ParsedStory } from "./story-parser.js";

const HIGH_EFFORT_KEYWORDS = [
  "implement",
  "create",
  "integrate",
  "architect",
  "design",
  "refactor",
  "migrate",
];
const MEDIUM_EFFORT_KEYWORDS = ["add", "update", "extend", "modify", "configure"];
const EXTERNAL_DEPENDENCY_KEYWORDS = [
  "api",
  "endpoint",
  "service",
  "firebase",
  "database",
  "auth",
  "external",
];
const TESTING_KEYWORDS = ["test", "integration", "e2e", "manual", "verify", "validation"];

const VAGUE_PATTERNS = [
  /^(implement|create|add|build)\s+\w+$/i,
  /^(task|todo):\s*\w+$/i,
  /^(do|make|handle)\s+.{1,20}$/i,
];

function isVagueDescription(desc: string): boolean {
  if (VAGUE_PATTERNS.some((p) => p.test(desc.trim()))) {
    return true;
  }
  const hasSpecifics = /\.(ts|js|dart|py|md)|\/|:\d+|\d{2,}/.test(desc);
  return desc.length < 30 && !hasSpecifics;
}

function pointsToEffort(points: number): TaskEffortLevel {
  if (points <= 1) return "trivial";
  if (points <= 2) return "small";
  if (points <= 3) return "medium";
  if (points <= 5) return "large";
  return "xlarge";
}

function mapToFibonacci(points: number): number {
  const fibScale = [1, 2, 3, 5, 8];
  return fibScale.reduce((prev, curr) =>
    Math.abs(curr - points) < Math.abs(prev - points) ? curr : prev
  );
}

export function estimateTaskEffort(task: ParsedTask): TaskEffortEstimate {
  let rawPoints = 1;
  const signals: string[] = [];
  const descLower = task.description.toLowerCase();

  if (task.subtasks.length > 5) {
    rawPoints += 3;
    signals.push(`${task.subtasks.length} subtasks (high complexity)`);
  } else if (task.subtasks.length > 2) {
    rawPoints += 1;
    signals.push(`${task.subtasks.length} subtasks`);
  }

  if (isVagueDescription(task.description)) {
    rawPoints += 2;
    signals.push("Vague description - hidden complexity likely");
  }

  if (HIGH_EFFORT_KEYWORDS.some((k) => descLower.includes(k))) {
    rawPoints += 2;
    signals.push("High-effort action keyword");
  } else if (MEDIUM_EFFORT_KEYWORDS.some((k) => descLower.includes(k))) {
    rawPoints += 1;
    signals.push("Medium-effort action keyword");
  }

  if (TESTING_KEYWORDS.some((k) => descLower.includes(k))) {
    rawPoints += 1;
    signals.push("Testing/verification required");
  }

  if (task.subtasks.some((s) => s.description.includes("/"))) {
    rawPoints += 1;
    signals.push("Multiple file paths mentioned");
  }

  if (EXTERNAL_DEPENDENCY_KEYWORDS.some((k) => descLower.includes(k))) {
    rawPoints += 1;
    signals.push("External system integration");
  }

  const points = mapToFibonacci(rawPoints);

  return {
    taskId: task.id,
    description: task.description,
    effort: pointsToEffort(points),
    points,
    signals,
  };
}

export function calculateStoryMetrics(
  parsedStory: ParsedStory,
  fileSizeBytes: number
): StoryMetrics {
  const subtaskCount = parsedStory.tasks.reduce((sum, task) => sum + task.subtasks.length, 0);

  return {
    taskCount: parsedStory.tasks.length,
    subtaskCount,
    acceptanceCriteriaCount: parsedStory.acceptanceCriteriaCount,
    storyFileSizeKB: Math.round(fileSizeBytes / 1024),
    lineCount: parsedStory.lineCount,
  };
}

export function assessStoryComplexity(
  parsedStory: ParsedStory,
  fileSizeBytes: number,
  thresholds: ComplexityThresholds = DEFAULT_COMPLEXITY_THRESHOLDS
): StoryComplexityAssessment {
  const metrics = calculateStoryMetrics(parsedStory, fileSizeBytes);
  const taskEfforts = parsedStory.tasks.map(estimateTaskEffort);
  const totalPoints = taskEfforts.reduce((sum, te) => sum + te.points, 0);

  const thresholdReasons: string[] = [];
  let requireDecomp = false;
  let suggestDecomp = false;

  if (metrics.taskCount >= thresholds.criticalTasks) {
    thresholdReasons.push(
      `Task count (${metrics.taskCount}) exceeds critical limit (${thresholds.criticalTasks})`
    );
    requireDecomp = true;
  } else if (metrics.taskCount >= thresholds.maxTasks) {
    thresholdReasons.push(
      `Task count (${metrics.taskCount}) exceeds recommended limit (${thresholds.maxTasks})`
    );
    suggestDecomp = true;
  }

  if (totalPoints >= thresholds.criticalPoints) {
    thresholdReasons.push(
      `Story points (${totalPoints}) exceed critical limit (${thresholds.criticalPoints})`
    );
    requireDecomp = true;
  } else if (totalPoints >= thresholds.maxPoints) {
    thresholdReasons.push(
      `Story points (${totalPoints}) exceed recommended limit (${thresholds.maxPoints})`
    );
    suggestDecomp = true;
  }

  if (metrics.storyFileSizeKB >= thresholds.criticalFileSizeKB) {
    thresholdReasons.push(
      `File size (${metrics.storyFileSizeKB}KB) exceeds critical limit (${thresholds.criticalFileSizeKB}KB)`
    );
    requireDecomp = true;
  } else if (metrics.storyFileSizeKB >= thresholds.maxFileSizeKB) {
    thresholdReasons.push(
      `File size (${metrics.storyFileSizeKB}KB) exceeds recommended limit (${thresholds.maxFileSizeKB}KB)`
    );
    suggestDecomp = true;
  }

  const recommendation: ComplexityRecommendation = requireDecomp
    ? "require-decomposition"
    : suggestDecomp
      ? "suggest-decomposition"
      : "proceed";

  const estimatedCompactions = Math.max(0, Math.floor((totalPoints - 8) / 8));

  return {
    storyId: parsedStory.storyId,
    filename: "",
    metrics,
    taskEfforts,
    totalPoints,
    exceedsThreshold: thresholdReasons.length > 0,
    thresholdReasons,
    recommendation,
    estimatedCompactions,
  };
}

export function formatEffortBar(points: number): string {
  const filled = Math.min(points, 5);
  const empty = 5 - filled;
  return `[${"■".repeat(filled)}${"□".repeat(empty)}]`;
}

export function formatComplexityReport(assessment: StoryComplexityAssessment): string {
  const lines: string[] = [];
  const {
    metrics,
    taskEfforts,
    totalPoints,
    recommendation,
    thresholdReasons,
    estimatedCompactions,
  } = assessment;

  const taskStatus = metrics.taskCount >= 12 ? "🔴" : metrics.taskCount >= 8 ? "⚠️" : "✅";
  const pointsStatus = totalPoints >= 13 ? "🔴" : totalPoints >= 8 ? "⚠️" : "✅";
  const sizeStatus =
    metrics.storyFileSizeKB >= 50 ? "🔴" : metrics.storyFileSizeKB >= 30 ? "⚠️" : "✅";

  lines.push("📊 COMPLEXITY ANALYSIS");
  lines.push("━".repeat(45));
  lines.push(`Tasks: ${metrics.taskCount} / 8 recommended                    ${taskStatus}`);
  lines.push(`Points: ${totalPoints} / 8 threshold                      ${pointsStatus}`);
  lines.push(`File size: ${metrics.storyFileSizeKB}KB / 30KB                        ${sizeStatus}`);
  lines.push(`Estimated compactions: ${estimatedCompactions}`);
  lines.push("");

  lines.push("📋 TASK EFFORT BREAKDOWN");
  lines.push("━".repeat(45));
  for (const te of taskEfforts) {
    const desc =
      te.description.length > 35
        ? `${te.description.substring(0, 32)}...`
        : te.description.padEnd(35);
    lines.push(`Task ${te.taskId}: ${desc} ${formatEffortBar(te.points)} ${te.points} pts`);
    if (te.signals.length > 0) {
      lines.push(`   └─ Signals: ${te.signals.join(", ")}`);
    }
  }
  lines.push(`Total: ${totalPoints} story points`);
  lines.push("");

  if (recommendation === "require-decomposition") {
    lines.push("🔴 DECOMPOSITION REQUIRED");
    lines.push("   This story exceeds safe implementation limits and will likely");
    lines.push("   require multiple context compactions.");
  } else if (recommendation === "suggest-decomposition") {
    lines.push("🟡 DECOMPOSITION SUGGESTED");
    lines.push("   This story can be implemented but may require compaction.");
    lines.push("   Splitting is recommended for cleaner implementation.");
  } else {
    lines.push("🟢 COMPLEXITY OK");
    lines.push("   This story is within recommended limits.");
  }

  if (thresholdReasons.length > 0) {
    lines.push("");
    lines.push("Threshold issues:");
    for (const reason of thresholdReasons) {
      lines.push(`  • ${reason}`);
    }
  }

  return lines.join("\n");
}
