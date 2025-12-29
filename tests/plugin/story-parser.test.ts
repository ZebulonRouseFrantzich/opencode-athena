import { describe, expect, it } from "vitest";
import {
  parseStoryTasks,
  extractDevNotesForTasks,
  generateTaskSection,
} from "../../src/plugin/utils/story-parser.js";

describe("story-parser", () => {
  describe("parseStoryTasks", () => {
    it("parses basic tasks with checkboxes", () => {
      const content = `# Story 3.2: Test Story

## Tasks / Subtasks

- [ ] Task 1: Create user service
- [x] Task 2: Add authentication
- [ ] Task 3: Write tests
`;
      const result = parseStoryTasks(content, "3.2");

      expect(result.storyId).toBe("3.2");
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0]).toMatchObject({
        id: "1",
        description: "Create user service",
        completed: false,
      });
      expect(result.tasks[1]).toMatchObject({
        id: "2",
        description: "Add authentication",
        completed: true,
      });
    });

    it("parses tasks with subtasks", () => {
      const content = `# Story 3.2: Test Story

## Tasks / Subtasks

- [ ] Task 1: Create user service
  - [ ] 1.1: Create user model
  - [x] 1.2: Add validation
  - [ ] 1.3: Write repository
- [ ] Task 2: Add tests
`;
      const result = parseStoryTasks(content, "3.2");

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].subtasks).toHaveLength(3);
      expect(result.tasks[0].subtasks[0]).toMatchObject({
        id: "1.1",
        description: "Create user model",
        completed: false,
      });
      expect(result.tasks[0].subtasks[1]).toMatchObject({
        id: "1.2",
        description: "Add validation",
        completed: true,
      });
    });

    it("handles alternative subtask format without IDs", () => {
      const content = `# Story 3.2: Test Story

## Tasks

- [ ] Task 1: Create service
  - [ ] Create model file
  - [x] Add types
`;
      const result = parseStoryTasks(content, "3.2");

      expect(result.tasks[0].subtasks).toHaveLength(2);
      expect(result.tasks[0].subtasks[0].id).toBe("1.1");
      expect(result.tasks[0].subtasks[1].id).toBe("1.2");
    });

    it("extracts story title", () => {
      const content = `# Story 3.2: My Amazing Feature

## Tasks
- [ ] Task 1: Do something
`;
      const result = parseStoryTasks(content, "3.2");
      expect(result.title).toBe("My Amazing Feature");
    });

    it("counts acceptance criteria", () => {
      const content = `# Story 3.2: Feature

## Acceptance Criteria

**Given** a user is logged in
**When** they click the button
**Then** something happens

**Given** another scenario
**When** they do this
**Then** that happens

## Tasks
- [ ] Task 1: Implement
`;
      const result = parseStoryTasks(content, "3.2");
      expect(result.acceptanceCriteriaCount).toBe(2);
    });

    it("detects dev notes section", () => {
      const content = `# Story 3.2: Feature

## Tasks
- [ ] Task 1: Do thing

## Dev Notes

### Complexity Assessment
This is complex.

### Technical Requirements
Use TypeScript.
`;
      const result = parseStoryTasks(content, "3.2");
      expect(result.hasDevNotes).toBe(true);
      expect(result.devNotesStartLine).toBeGreaterThan(0);
    });

    it("handles empty task list", () => {
      const content = `# Story 3.2: Feature

## Description
Just some description without tasks.
`;
      const result = parseStoryTasks(content, "3.2");
      expect(result.tasks).toHaveLength(0);
    });

    it("handles uppercase X in checkboxes", () => {
      const content = `# Story

## Tasks
- [X] Task 1: Completed with uppercase X
- [x] Task 2: Completed with lowercase x
- [ ] Task 3: Not completed
`;
      const result = parseStoryTasks(content, "1.1");
      expect(result.tasks[0].completed).toBe(true);
      expect(result.tasks[1].completed).toBe(true);
      expect(result.tasks[2].completed).toBe(false);
    });

    it("tracks line numbers", () => {
      const content = `# Story

Line 2
Line 3

## Tasks
- [ ] Task 1: First task
  - [ ] Subtask
- [ ] Task 2: Second task
`;
      const result = parseStoryTasks(content, "1.1");
      expect(result.tasks[0].lineNumber).toBe(7);
      expect(result.tasks[0].subtasks[0].lineNumber).toBe(8);
      expect(result.tasks[1].lineNumber).toBe(9);
    });
  });

  describe("extractDevNotesForTasks", () => {
    it("extracts task-specific dev notes", () => {
      const content = `# Story

## Tasks
- [ ] Task 1: Create service
- [ ] Task 2: Add tests

## Dev Notes

### Task 1 Implementation
Important notes for task 1.

### Task 2 Testing
Notes about testing.

### General Architecture
Shared notes.
`;
      const result = extractDevNotesForTasks(content, ["1"]);
      expect(result).toContain("Task 1 Implementation");
      expect(result).not.toContain("Task 2 Testing");
    });

    it("includes common sections for all tasks", () => {
      const content = `# Story

## Tasks
- [ ] Task 1: Do thing

## Dev Notes

### Technical Requirements
Must use TypeScript.

### Architecture Compliance
Follow patterns.
`;
      const result = extractDevNotesForTasks(content, ["1"]);
      expect(result).toContain("Technical Requirements");
      expect(result).toContain("Architecture Compliance");
    });

    it("returns empty string when no dev notes", () => {
      const content = `# Story

## Tasks
- [ ] Task 1: Do thing
`;
      const result = extractDevNotesForTasks(content, ["1"]);
      expect(result).toBe("");
    });
  });

  describe("generateTaskSection", () => {
    it("generates task markdown from parsed tasks", () => {
      const tasks = [
        {
          id: "1",
          description: "Create service",
          subtasks: [
            { id: "1.1", description: "Create model", completed: false, lineNumber: 2 },
            { id: "1.2", description: "Add types", completed: true, lineNumber: 3 },
          ],
          completed: false,
          lineNumber: 1,
        },
        {
          id: "2",
          description: "Write tests",
          subtasks: [],
          completed: true,
          lineNumber: 4,
        },
      ];

      const result = generateTaskSection(tasks);

      expect(result).toContain("## Tasks / Subtasks");
      expect(result).toContain("- [ ] Task 1: Create service");
      expect(result).toContain("  - [ ] 1.1: Create model");
      expect(result).toContain("  - [x] 1.2: Add types");
      expect(result).toContain("- [x] Task 2: Write tests");
    });

    it("handles empty task list", () => {
      const result = generateTaskSection([]);
      expect(result).toContain("## Tasks / Subtasks");
    });
  });
});
