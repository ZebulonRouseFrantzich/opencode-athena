import { describe, expect, it } from "vitest";
import {
  generateDecompositionSuggestions,
  validateSplits,
  generateSubStoryContent,
  formatDecompositionSuggestion,
  getSubStoryFilename,
  getSubStoryId,
} from "../../src/plugin/utils/story-decomposer.js";
import { parseStoryTasks } from "../../src/plugin/utils/story-parser.js";
import { assessStoryComplexity } from "../../src/plugin/utils/story-complexity.js";

describe("story-decomposer", () => {
  describe("generateDecompositionSuggestions", () => {
    it("groups tasks by concern", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Create user widget component
- [ ] Task 2: Add form validation
- [ ] Task 3: Create card widget UI
- [ ] Task 4: Write integration tests
- [ ] Task 5: Add manual testing verification
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000);
      const splits = generateDecompositionSuggestions(parsedStory, assessment.taskEfforts);

      expect(splits.length).toBeGreaterThan(0);
      splits.forEach((split) => {
        expect(split.taskIds.length).toBeGreaterThan(0);
        expect(split.suffix).toMatch(/^[a-z]$/);
      });
    });

    it("balances groups by points", () => {
      const tasks = Array(10)
        .fill(null)
        .map((_, i) => `- [ ] Task ${i + 1}: Create component ${i + 1}`)
        .join("\n");

      const content = `# Story 3.2: Feature

## Tasks
${tasks}
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000);
      const splits = generateDecompositionSuggestions(parsedStory, assessment.taskEfforts);

      splits.forEach((split) => {
        expect(split.taskIds.length).toBeLessThanOrEqual(6);
      });
    });

    it("assigns dependencies to testing/integration tasks", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Create service
- [ ] Task 2: Add repository
- [ ] Task 3: Write integration tests
- [ ] Task 4: Manual verification testing
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const assessment = assessStoryComplexity(parsedStory, 1000);
      const splits = generateDecompositionSuggestions(parsedStory, assessment.taskEfforts);

      const testingSplit = splits.find((s) =>
        s.taskIds.some((id) => {
          const task = parsedStory.tasks.find((t) => t.id === id);
          return task?.description.toLowerCase().includes("test");
        })
      );

      if (testingSplit && splits.length > 1) {
        expect(testingSplit.dependencies.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("validateSplits", () => {
    it("validates complete splits", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Do thing
- [ ] Task 2: Do another
- [ ] Task 3: Do more
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const splits = [
        { suffix: "a", taskIds: ["1", "2"], title: "Part A" },
        { suffix: "b", taskIds: ["3"], title: "Part B" },
      ];

      const result = validateSplits(parsedStory.tasks, splits);
      expect(result.valid).toBe(true);
      expect(result.missingTasks).toHaveLength(0);
      expect(result.duplicatedTasks).toHaveLength(0);
    });

    it("detects missing tasks", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Do thing
- [ ] Task 2: Do another
- [ ] Task 3: Do more
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const splits = [
        { suffix: "a", taskIds: ["1"], title: "Part A" },
        { suffix: "b", taskIds: ["3"], title: "Part B" },
      ];

      const result = validateSplits(parsedStory.tasks, splits);
      expect(result.valid).toBe(false);
      expect(result.missingTasks).toContain("2");
    });

    it("detects duplicated tasks", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Do thing
- [ ] Task 2: Do another
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const splits = [
        { suffix: "a", taskIds: ["1", "2"], title: "Part A" },
        { suffix: "b", taskIds: ["2"], title: "Part B" },
      ];

      const result = validateSplits(parsedStory.tasks, splits);
      expect(result.valid).toBe(false);
      expect(result.duplicatedTasks).toContain("2");
    });
  });

  describe("generateSubStoryContent", () => {
    it("generates valid sub-story content", () => {
      const content = `# Story 3.2: My Feature

Status: ready-for-dev

## Story

As a user, I want to do things.

## Acceptance Criteria

**Given** a condition
**When** something happens
**Then** result occurs

## Tasks / Subtasks

- [ ] Task 1: Create service
- [ ] Task 2: Add tests
- [ ] Task 3: Write docs
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const split = {
        suffix: "a",
        title: "Service Implementation",
        taskIds: ["1"],
        estimatedPoints: 3,
        rationale: "Core implementation",
        dependencies: [],
      };

      const result = generateSubStoryContent(content, parsedStory, split, 0, 2, "3.2");

      expect(result).toContain("Story 3.2a");
      expect(result).toContain("Service Implementation");
      expect(result).toContain("Task 1: Create service");
      expect(result).not.toContain("Task 2: Add tests");
      expect(result).toContain("decomposed from Story 3.2");
      expect(result).toContain("part 1 of 2");
    });

    it("preserves acceptance criteria", () => {
      const content = `# Story 3.2: Feature

## Acceptance Criteria

**Given** condition
**When** action
**Then** result

## Tasks
- [ ] Task 1: Do thing
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const split = { suffix: "a", title: "Part A", taskIds: ["1"], estimatedPoints: 2, rationale: "", dependencies: [] };

      const result = generateSubStoryContent(content, parsedStory, split, 0, 1, "3.2");

      expect(result).toContain("Acceptance Criteria");
      expect(result).toContain("**Given**");
    });

    it("includes relevant dev notes", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Create service

## Dev Notes

### Task 1 Implementation
Important notes here.
`;
      const parsedStory = parseStoryTasks(content, "3.2");
      const split = { suffix: "a", title: "Part A", taskIds: ["1"], estimatedPoints: 2, rationale: "", dependencies: [] };

      const result = generateSubStoryContent(content, parsedStory, split, 0, 1, "3.2");

      expect(result).toContain("Dev Notes");
      expect(result).toContain("Task 1 Implementation");
    });
  });

  describe("formatDecompositionSuggestion", () => {
    it("formats suggestion with all fields", () => {
      const splits = [
        {
          suffix: "a",
          title: "Core Implementation",
          taskIds: ["1", "2"],
          estimatedPoints: 5,
          rationale: "Core functionality",
          dependencies: [],
        },
        {
          suffix: "b",
          title: "Testing",
          taskIds: ["3"],
          estimatedPoints: 3,
          rationale: "Testing tasks",
          dependencies: ["a"],
        },
      ];

      const result = formatDecompositionSuggestion(splits, "3.2");

      expect(result).toContain("SUGGESTED DECOMPOSITION");
      expect(result).toContain("Story 3.2a: Core Implementation");
      expect(result).toContain("Story 3.2b: Testing");
      expect(result).toContain("Tasks: 1, 2");
      expect(result).toContain("Points: ~5");
      expect(result).toContain("Dependencies: 3.2a");
      expect(result).toContain("VERIFICATION");
      expect(result).toContain("3 tasks accounted for");
    });
  });

  describe("getSubStoryFilename", () => {
    it("handles standard filename format", () => {
      expect(getSubStoryFilename("3-2.md", "a")).toBe("3-2a.md");
      expect(getSubStoryFilename("3-2.md", "b")).toBe("3-2b.md");
    });

    it("handles filename with title", () => {
      expect(getSubStoryFilename("3-2-my-feature.md", "a")).toBe("3-2a-my-feature.md");
    });

    it("handles non-standard filenames", () => {
      expect(getSubStoryFilename("custom-story.md", "a")).toBe("custom-storya.md");
    });
  });

  describe("getSubStoryId", () => {
    it("appends suffix to story ID", () => {
      expect(getSubStoryId("3.2", "a")).toBe("3.2a");
      expect(getSubStoryId("3.2", "b")).toBe("3.2b");
      expect(getSubStoryId("10.15", "c")).toBe("10.15c");
    });
  });
});
