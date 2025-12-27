import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseBmadTasks,
  bmadTasksToTodos,
  parseTodoId,
  isBmadTodo,
  extractStoryIdFromContent,
  findCheckboxLine,
  updateBmadCheckbox,
  mergeTodos,
  ATHENA_SEPARATOR,
} from "../../src/plugin/utils/todo-sync.js";
import type { OpenCodeTodo } from "../../src/shared/types.js";

describe("todo-sync", () => {
  describe("parseBmadTasks", () => {
    it("parses acceptance criteria checkboxes", () => {
      const content = `
# Story 2.3

## Acceptance Criteria

- [ ] AC1: Users can login with email
- [x] AC2: Password is hashed
- [ ] AC3: JWT token returned
`;
      const tasks = parseBmadTasks(content, "2.3");

      expect(tasks).toHaveLength(3);
      expect(tasks[0].section).toBe("ac");
      expect(tasks[0].sectionIndex).toBe(1);
      expect(tasks[0].checked).toBe(false);
      expect(tasks[0].content).toBe("AC1: Users can login with email");
      expect(tasks[1].checked).toBe(true);
      expect(tasks[2].sectionIndex).toBe(3);
    });

    it("parses tasks section with subtasks", () => {
      const content = `
## Tasks / Subtasks

- [ ] Task 1: Setup auth module
  - [ ] Subtask 1.1: Create folder structure
- [x] Task 2: Implement login
`;
      const tasks = parseBmadTasks(content, "2.3");

      expect(tasks).toHaveLength(3);
      expect(tasks[0].section).toBe("tasks");
      expect(tasks[0].indent).toBe(0);
      expect(tasks[1].indent).toBe(2);
      expect(tasks[2].checked).toBe(true);
    });

    it("detects priority from content", () => {
      const content = `
## Implementation Notes

- [ ] Critical: Fix security issue - Priority: Critical
- [ ] Should add validation - Priority: Medium
- [ ] Could improve logging - Priority: Low
`;
      const tasks = parseBmadTasks(content, "2.3");

      expect(tasks[0].priority).toBe("high");
      expect(tasks[1].priority).toBe("medium");
      expect(tasks[2].priority).toBe("low");
    });

    it("uses section-based defaults for priority", () => {
      const content = `
## Acceptance Criteria

- [ ] AC1: Some feature

## Tasks / Subtasks

- [ ] Task 1: Some task

## Implementation Notes

- [ ] Some finding without explicit priority
`;
      const tasks = parseBmadTasks(content, "2.3");

      expect(tasks[0].priority).toBe("high"); // AC defaults to high
      expect(tasks[1].priority).toBe("medium"); // Tasks default to medium
      expect(tasks[2].priority).toBe("medium"); // Impl notes default to medium
    });

    it("handles multiple sections in one file", () => {
      const content = `
## Acceptance Criteria
- [ ] AC1: Feature works

## Tasks / Subtasks
- [ ] Task 1: Implement feature

## Implementation Notes
- [ ] Fix: Security issue
`;
      const tasks = parseBmadTasks(content, "2.3");

      expect(tasks).toHaveLength(3);
      expect(tasks[0].section).toBe("ac");
      expect(tasks[1].section).toBe("tasks");
      expect(tasks[2].section).toBe("impl-notes");
    });

    it("resets section on other H2 headers", () => {
      const content = `
## Acceptance Criteria
- [ ] AC1: Feature

## Dev Notes
Some notes here

- [ ] This is NOT a task (not in valid section)
`;
      const tasks = parseBmadTasks(content, "2.3");

      expect(tasks).toHaveLength(1);
      expect(tasks[0].content).toBe("AC1: Feature");
    });

    it("handles empty content", () => {
      const tasks = parseBmadTasks("", "2.3");
      expect(tasks).toHaveLength(0);
    });

    it("handles content with no checkboxes", () => {
      const content = `
# Story 2.3

## Acceptance Criteria

1. Users can login
2. Password is hashed
`;
      const tasks = parseBmadTasks(content, "2.3");
      expect(tasks).toHaveLength(0);
    });

    it("handles uppercase X in checkboxes", () => {
      const content = `
## Tasks
- [X] Completed with uppercase X
`;
      const tasks = parseBmadTasks(content, "2.3");
      expect(tasks[0].checked).toBe(true);
    });
  });

  describe("bmadTasksToTodos", () => {
    it("formats todos with Athena prefix", () => {
      const tasks = [
        {
          id: "2.3:ac:10",
          storyId: "2.3",
          section: "ac" as const,
          sectionIndex: 1,
          lineNumber: 10,
          content: "Implement login",
          checked: false,
          priority: "high" as const,
          indent: 0,
        },
      ];

      const todos = bmadTasksToTodos(tasks);

      expect(todos[0].id).toBe("2.3:ac:10");
      expect(todos[0].content).toBe(`[2.3${ATHENA_SEPARATOR}AC1] Implement login`);
      expect(todos[0].status).toBe("pending");
      expect(todos[0].priority).toBe("high");
    });

    it("marks completed tasks correctly", () => {
      const tasks = [
        {
          id: "2.3:ac:10",
          storyId: "2.3",
          section: "ac" as const,
          sectionIndex: 1,
          lineNumber: 10,
          content: "Task",
          checked: true,
          priority: "medium" as const,
          indent: 0,
        },
      ];

      const todos = bmadTasksToTodos(tasks);
      expect(todos[0].status).toBe("completed");
    });

    it("preserves subtask indentation", () => {
      const tasks = [
        {
          id: "2.3:tasks:15",
          storyId: "2.3",
          section: "tasks" as const,
          sectionIndex: 2,
          lineNumber: 15,
          content: "Subtask 1.1",
          checked: false,
          priority: "medium" as const,
          indent: 2,
        },
      ];

      const todos = bmadTasksToTodos(tasks);
      expect(todos[0].content).toMatch(/^\s{2}\[2\.3/);
    });

    it("uses correct section labels", () => {
      const tasks = [
        {
          id: "2.3:ac:10",
          storyId: "2.3",
          section: "ac" as const,
          sectionIndex: 1,
          lineNumber: 10,
          content: "AC task",
          checked: false,
          priority: "high" as const,
          indent: 0,
        },
        {
          id: "2.3:tasks:20",
          storyId: "2.3",
          section: "tasks" as const,
          sectionIndex: 1,
          lineNumber: 20,
          content: "Regular task",
          checked: false,
          priority: "medium" as const,
          indent: 0,
        },
        {
          id: "2.3:impl-notes:30",
          storyId: "2.3",
          section: "impl-notes" as const,
          sectionIndex: 1,
          lineNumber: 30,
          content: "Fix something",
          checked: false,
          priority: "high" as const,
          indent: 0,
        },
      ];

      const todos = bmadTasksToTodos(tasks);
      expect(todos[0].content).toContain("AC1");
      expect(todos[1].content).toContain("Task1");
      expect(todos[2].content).toContain("Fix1");
    });
  });

  describe("parseTodoId", () => {
    it("extracts story and location from ID", () => {
      const parsed = parseTodoId("2.3:ac:42");

      expect(parsed).toEqual({
        storyId: "2.3",
        section: "ac",
        lineHint: 42,
      });
    });

    it("handles different sections", () => {
      expect(parseTodoId("2.3:tasks:10")?.section).toBe("tasks");
      expect(parseTodoId("2.3:impl-notes:20")?.section).toBe("impl-notes");
      expect(parseTodoId("2.3:ac:5")?.section).toBe("ac");
    });

    it("handles multi-digit story IDs", () => {
      const parsed = parseTodoId("10.15:ac:42");
      expect(parsed?.storyId).toBe("10.15");
    });

    it("returns null for invalid format", () => {
      expect(parseTodoId("invalid")).toBeNull();
      expect(parseTodoId("2.3:ac")).toBeNull();
      expect(parseTodoId("")).toBeNull();
      expect(parseTodoId("2.3:invalid:10")).toBeNull();
    });
  });

  describe("isBmadTodo", () => {
    it("identifies BMAD todos by prefix", () => {
      expect(
        isBmadTodo({ id: "1", content: "[2.3ΔAC1] Task", status: "pending", priority: "medium" })
      ).toBe(true);
      expect(
        isBmadTodo({ id: "2", content: "[2.4ΔTask1] Task", status: "pending", priority: "medium" })
      ).toBe(true);
      expect(
        isBmadTodo({ id: "3", content: "  [2.3ΔFix1] Task", status: "pending", priority: "medium" })
      ).toBe(true);
    });

    it("identifies user todos (no prefix)", () => {
      expect(
        isBmadTodo({
          id: "1",
          content: "Remember to update README",
          status: "pending",
          priority: "medium",
        })
      ).toBe(false);
      expect(
        isBmadTodo({ id: "2", content: "Check CI pipeline", status: "pending", priority: "medium" })
      ).toBe(false);
      expect(
        isBmadTodo({ id: "3", content: "Review PR #42", status: "pending", priority: "medium" })
      ).toBe(false);
    });

    it("does not match similar but incorrect patterns", () => {
      expect(
        isBmadTodo({ id: "1", content: "[AC1] Task", status: "pending", priority: "medium" })
      ).toBe(false);
      expect(
        isBmadTodo({ id: "2", content: "2.3 Task", status: "pending", priority: "medium" })
      ).toBe(false);
    });
  });

  describe("extractStoryIdFromContent", () => {
    it("extracts story ID from BMAD todo content", () => {
      expect(extractStoryIdFromContent("[2.3ΔAC1] Task")).toBe("2.3");
      expect(extractStoryIdFromContent("[10.15ΔTask1] Task")).toBe("10.15");
      expect(extractStoryIdFromContent("  [2.3ΔFix1] Task")).toBe("2.3");
    });

    it("returns null for non-BMAD content", () => {
      expect(extractStoryIdFromContent("Regular todo")).toBeNull();
      expect(extractStoryIdFromContent("Check CI")).toBeNull();
      expect(extractStoryIdFromContent("[AC1] Task")).toBeNull();
    });
  });

  describe("mergeTodos", () => {
    it("preserves user todos when loading BMAD story", () => {
      const existingTodos: OpenCodeTodo[] = [
        { id: "user-1", content: "Update README", status: "pending", priority: "medium" },
        { id: "2.2:ac:10", content: "[2.2ΔAC1] Old task", status: "pending", priority: "high" },
      ];
      const newBmadTodos: OpenCodeTodo[] = [
        { id: "2.3:ac:10", content: "[2.3ΔAC1] New task", status: "pending", priority: "high" },
      ];

      const merged = mergeTodos(existingTodos, newBmadTodos, "2.3");

      expect(merged).toHaveLength(3);
      expect(merged.find((t) => t.content === "Update README")).toBeDefined();
      expect(merged.find((t) => t.content.includes("[2.2Δ"))).toBeDefined();
      expect(merged.find((t) => t.content.includes("[2.3Δ"))).toBeDefined();
    });

    it("removes completed BMAD todos when switching stories", () => {
      const existingTodos: OpenCodeTodo[] = [
        {
          id: "2.2:ac:10",
          content: "[2.2ΔAC1] Completed task",
          status: "completed",
          priority: "high",
        },
        {
          id: "2.2:ac:20",
          content: "[2.2ΔAC2] Incomplete task",
          status: "pending",
          priority: "high",
        },
      ];
      const newBmadTodos: OpenCodeTodo[] = [
        { id: "2.3:ac:10", content: "[2.3ΔAC1] New task", status: "pending", priority: "high" },
      ];

      const merged = mergeTodos(existingTodos, newBmadTodos, "2.3");

      expect(merged).toHaveLength(2);
      expect(merged.find((t) => t.content.includes("Completed task"))).toBeUndefined();
      expect(merged.find((t) => t.content.includes("Incomplete task"))).toBeDefined();
    });

    it("replaces todos from same story being loaded", () => {
      const existingTodos: OpenCodeTodo[] = [
        { id: "2.3:ac:10", content: "[2.3ΔAC1] Old version", status: "pending", priority: "high" },
      ];
      const newBmadTodos: OpenCodeTodo[] = [
        {
          id: "2.3:ac:10",
          content: "[2.3ΔAC1] Updated version",
          status: "pending",
          priority: "high",
        },
      ];

      const merged = mergeTodos(existingTodos, newBmadTodos, "2.3");

      expect(merged).toHaveLength(1);
      expect(merged[0].content).toContain("Updated version");
    });

    it("handles empty existing todos", () => {
      const newBmadTodos: OpenCodeTodo[] = [
        { id: "2.3:ac:10", content: "[2.3ΔAC1] New task", status: "pending", priority: "high" },
      ];

      const merged = mergeTodos([], newBmadTodos, "2.3");

      expect(merged).toHaveLength(1);
    });

    it("handles empty new todos", () => {
      const existingTodos: OpenCodeTodo[] = [
        { id: "user-1", content: "User task", status: "pending", priority: "medium" },
      ];

      const merged = mergeTodos(existingTodos, [], "2.3");

      expect(merged).toHaveLength(1);
      expect(merged[0].content).toBe("User task");
    });
  });

  describe("file operations", () => {
    let testDir: string;
    let storyPath: string;

    beforeEach(() => {
      testDir = mkdtempSync(join(tmpdir(), "todo-sync-test-"));
      storyPath = join(testDir, "story-2-3.md");
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    describe("findCheckboxLine", () => {
      it("finds checkbox at exact line", async () => {
        const content = `
## Acceptance Criteria

- [ ] AC1: Implement login endpoint
- [ ] AC2: Add password hashing
`;
        writeFileSync(storyPath, content);

        const found = await findCheckboxLine(storyPath, "Implement login endpoint", 3);
        expect(found).toBe(3);
      });

      it("finds checkbox after line shift", async () => {
        const content = `
## New Section Added

Some content here

## Acceptance Criteria

- [ ] AC1: Implement login endpoint
`;
        writeFileSync(storyPath, content);

        const found = await findCheckboxLine(storyPath, "Implement login endpoint", 3);
        expect(found).toBe(7);
      });

      it("finds checkbox with partial match", async () => {
        const content = `
## Acceptance Criteria

- [ ] Users can login with email and password
`;
        writeFileSync(storyPath, content);

        const found = await findCheckboxLine(storyPath, "login with email", 3);
        expect(found).toBe(3);
      });

      it("returns null for non-existent checkbox", async () => {
        const content = `
## Acceptance Criteria

- [ ] Some other task
`;
        writeFileSync(storyPath, content);

        const found = await findCheckboxLine(storyPath, "Non-existent task", 3);
        expect(found).toBeNull();
      });
    });

    describe("updateBmadCheckbox", () => {
      it("checks an unchecked checkbox", async () => {
        const content = `
## Acceptance Criteria

- [ ] AC1: Implement login
- [ ] AC2: Add tests
`;
        writeFileSync(storyPath, content);

        const result = await updateBmadCheckbox(storyPath, 3, true);
        expect(result).toBe(true);

        const updated = readFileSync(storyPath, "utf-8");
        expect(updated).toContain("- [x] AC1: Implement login");
        expect(updated).toContain("- [ ] AC2: Add tests");
      });

      it("unchecks a checked checkbox", async () => {
        const content = `
## Acceptance Criteria

- [x] AC1: Implement login
`;
        writeFileSync(storyPath, content);

        const result = await updateBmadCheckbox(storyPath, 3, false);
        expect(result).toBe(true);

        const updated = readFileSync(storyPath, "utf-8");
        expect(updated).toContain("- [ ] AC1: Implement login");
      });

      it("returns false for invalid line number", async () => {
        writeFileSync(storyPath, "# Story");

        const result = await updateBmadCheckbox(storyPath, 100, true);
        expect(result).toBe(false);
      });

      it("returns false for non-checkbox line", async () => {
        const content = `
# Story

Regular text here
`;
        writeFileSync(storyPath, content);

        const result = await updateBmadCheckbox(storyPath, 3, true);
        expect(result).toBe(false);
      });
    });

    describe("end-to-end", () => {
      it("parses, updates, and re-parses correctly", async () => {
        const content = `
# Story 2.3

## Acceptance Criteria

- [ ] AC1: Implement login
- [ ] AC2: Add password hashing
- [ ] AC3: Return JWT token
`;
        writeFileSync(storyPath, content);

        const tasks1 = parseBmadTasks(content, "2.3");
        expect(tasks1).toHaveLength(3);
        expect(tasks1.every((t) => !t.checked)).toBe(true);

        await updateBmadCheckbox(storyPath, tasks1[1].lineNumber, true);

        const updatedContent = readFileSync(storyPath, "utf-8");
        const tasks2 = parseBmadTasks(updatedContent, "2.3");

        expect(tasks2[0].checked).toBe(false);
        expect(tasks2[1].checked).toBe(true);
        expect(tasks2[2].checked).toBe(false);
      });
    });
  });
});
