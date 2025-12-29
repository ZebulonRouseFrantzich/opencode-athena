import { describe, expect, it } from "vitest";
import {
  estimateTaskEffort,
  calculateStoryMetrics,
  assessStoryComplexity,
  formatEffortBar,
  formatComplexityReport,
} from "../../src/plugin/utils/story-complexity.js";
import { parseStoryTasks } from "../../src/plugin/utils/story-parser.js";
import type { ParsedTask } from "../../src/shared/types.js";

describe("story-complexity", () => {
  describe("estimateTaskEffort", () => {
    it("estimates trivial task with no signals", () => {
      const task: ParsedTask = {
        id: "1",
        description: "Fix typo in README.md file at line 42",
        subtasks: [],
        completed: false,
        lineNumber: 1,
      };
      const result = estimateTaskEffort(task);
      expect(result.points).toBeLessThanOrEqual(2);
      expect(result.effort).toMatch(/trivial|small/);
    });

    it("increases points for many subtasks", () => {
      const task: ParsedTask = {
        id: "1",
        description: "Create feature",
        subtasks: Array(6)
          .fill(null)
          .map((_, i) => ({
            id: `1.${i + 1}`,
            description: `Subtask ${i + 1}`,
            completed: false,
            lineNumber: i + 2,
          })),
        completed: false,
        lineNumber: 1,
      };
      const result = estimateTaskEffort(task);
      expect(result.points).toBeGreaterThanOrEqual(3);
      expect(result.signals).toContain("6 subtasks (high complexity)");
    });

    it("detects high-effort keywords", () => {
      const task: ParsedTask = {
        id: "1",
        description: "Implement the authentication service with refactoring",
        subtasks: [],
        completed: false,
        lineNumber: 1,
      };
      const result = estimateTaskEffort(task);
      expect(result.signals.some((s) => s.includes("High-effort"))).toBe(true);
    });

    it("detects medium-effort keywords", () => {
      const task: ParsedTask = {
        id: "1",
        description: "Add validation to user form",
        subtasks: [],
        completed: false,
        lineNumber: 1,
      };
      const result = estimateTaskEffort(task);
      expect(result.signals.some((s) => s.includes("Medium-effort"))).toBe(true);
    });

    it("detects testing requirements", () => {
      const task: ParsedTask = {
        id: "1",
        description: "Write integration tests for API",
        subtasks: [],
        completed: false,
        lineNumber: 1,
      };
      const result = estimateTaskEffort(task);
      expect(result.signals.some((s) => s.includes("Testing"))).toBe(true);
    });

    it("detects external dependencies", () => {
      const task: ParsedTask = {
        id: "1",
        description: "Connect to Firebase authentication API",
        subtasks: [],
        completed: false,
        lineNumber: 1,
      };
      const result = estimateTaskEffort(task);
      expect(result.signals.some((s) => s.includes("External"))).toBe(true);
    });

    it("detects vague descriptions", () => {
      const task: ParsedTask = {
        id: "1",
        description: "Implement feature",
        subtasks: [],
        completed: false,
        lineNumber: 1,
      };
      const result = estimateTaskEffort(task);
      expect(result.signals.some((s) => s.includes("Vague"))).toBe(true);
    });

    it("maps points to Fibonacci scale", () => {
      const task: ParsedTask = {
        id: "1",
        description: "Simple task with detailed description about /path/to/file.ts",
        subtasks: [],
        completed: false,
        lineNumber: 1,
      };
      const result = estimateTaskEffort(task);
      expect([1, 2, 3, 5, 8]).toContain(result.points);
    });
  });

  describe("calculateStoryMetrics", () => {
    it("calculates basic metrics", () => {
      const content = `# Story 3.2: Test

## Tasks
- [ ] Task 1: Do thing
  - [ ] Subtask 1
  - [ ] Subtask 2
- [ ] Task 2: Do another thing
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const metrics = calculateStoryMetrics(parsedStory, 500);

      expect(metrics.taskCount).toBe(2);
      expect(metrics.subtaskCount).toBe(2);
      expect(metrics.storyFileSizeKB).toBe(0);
    });

    it("rounds file size to KB", () => {
      const content = `# Story 3.2: Test

## Tasks
- [ ] Task 1: Do thing
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const metrics = calculateStoryMetrics(parsedStory, 2048);
      expect(metrics.storyFileSizeKB).toBe(2);
    });
  });

  describe("assessStoryComplexity", () => {
    it("returns proceed for small stories", () => {
      const content = `# Story 3.2: Small Feature

## Tasks
- [ ] Task 1: Fix typo in header.tsx component file
- [ ] Task 2: Rename variable userList to users in /src/utils.ts
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000);

      expect(assessment.recommendation).toBe("proceed");
      expect(assessment.exceedsThreshold).toBe(false);
    });

    it("suggests decomposition for medium stories", () => {
      const tasks = Array(9)
        .fill(null)
        .map((_, i) => `- [ ] Task ${i + 1}: Rename file${i + 1}.ts to renamed${i + 1}.ts`)
        .join("\n");

      const content = `# Story 3.2: Medium Feature

## Tasks
${tasks}
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000);

      expect(assessment.recommendation).toBe("suggest-decomposition");
      expect(assessment.thresholdReasons.length).toBeGreaterThan(0);
    });

    it("requires decomposition for large stories", () => {
      const tasks = Array(13)
        .fill(null)
        .map(
          (_, i) =>
            `- [ ] Task ${i + 1}: Implement complex feature ${i + 1} with integration and testing`
        )
        .join("\n");

      const content = `# Story 3.2: Large Feature

## Tasks
${tasks}
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000);

      expect(assessment.recommendation).toBe("require-decomposition");
    });

    it("requires decomposition for large file size", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Do thing
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 60 * 1024);

      expect(assessment.recommendation).toBe("require-decomposition");
      expect(assessment.thresholdReasons.some((r) => r.includes("File size"))).toBe(true);
    });

    it("estimates context compactions", () => {
      const tasks = Array(10)
        .fill(null)
        .map(
          (_, i) =>
            `- [ ] Task ${i + 1}: Implement complex feature ${i + 1} with integration and testing`
        )
        .join("\n");

      const content = `# Story 3.2: Feature

## Tasks
${tasks}
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000);

      expect(assessment.estimatedCompactions).toBeGreaterThanOrEqual(0);
    });

    it("respects custom thresholds", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Rename fileA.ts to newFileA.ts
- [ ] Task 2: Rename fileB.ts to newFileB.ts
- [ ] Task 3: Rename fileC.ts to newFileC.ts
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000, {
        maxTasks: 2,
        criticalTasks: 10,
        maxPoints: 4,
        criticalPoints: 20,
        maxFileSizeKB: 10,
        criticalFileSizeKB: 20,
      });

      expect(assessment.recommendation).toBe("suggest-decomposition");
    });
  });

  describe("formatEffortBar", () => {
    it("renders bars correctly", () => {
      expect(formatEffortBar(1)).toBe("[■□□□□]");
      expect(formatEffortBar(3)).toBe("[■■■□□]");
      expect(formatEffortBar(5)).toBe("[■■■■■]");
      expect(formatEffortBar(8)).toBe("[■■■■■]");
    });
  });

  describe("formatComplexityReport", () => {
    it("includes all sections in report", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Create component
- [ ] Task 2: Add styling
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000);
      const report = formatComplexityReport(assessment);

      expect(report).toContain("COMPLEXITY ANALYSIS");
      expect(report).toContain("TASK EFFORT BREAKDOWN");
      expect(report).toContain("Tasks:");
      expect(report).toContain("Points:");
    });

    it("shows threshold issues when present", () => {
      const tasks = Array(10)
        .fill(null)
        .map((_, i) => `- [ ] Task ${i + 1}: Implement feature ${i + 1}`)
        .join("\n");

      const content = `# Story 3.2: Feature

## Tasks
${tasks}
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000);
      const report = formatComplexityReport(assessment);

      expect(report).toContain("Threshold issues:");
    });
  });
});
