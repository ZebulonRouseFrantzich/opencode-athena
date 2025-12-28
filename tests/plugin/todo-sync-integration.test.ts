import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseBmadTasks,
  bmadTasksToTodos,
  findCheckboxLine,
  updateBmadCheckbox,
} from "../../src/plugin/utils/todo-sync.js";

describe("todo-sync integration", () => {
  let testDir: string;
  let storyPath: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "todo-sync-test-"));
    mkdirSync(join(testDir, "stories"), { recursive: true });
    storyPath = join(testDir, "stories", "story-2-3.md");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("end-to-end flow", () => {
    it("parses story, converts to todos, updates checkbox, re-parses with updated state", async () => {
      const content = `# Story 2.3

## Acceptance Criteria

- [ ] AC1: Implement login
- [ ] AC2: Add password hashing
- [ ] AC3: Return JWT token
`;
      writeFileSync(storyPath, content);

      const tasks1 = parseBmadTasks(content, "2.3");
      expect(tasks1).toHaveLength(3);
      expect(tasks1.every((t) => !t.checked)).toBe(true);

      const todos = bmadTasksToTodos(tasks1);
      expect(todos).toHaveLength(3);
      expect(todos[0].content).toContain("[2.3ΔAC1]");
      expect(todos[0].status).toBe("pending");

      await updateBmadCheckbox(storyPath, tasks1[1].lineNumber, true);

      const updatedContent = readFileSync(storyPath, "utf-8");
      const tasks2 = parseBmadTasks(updatedContent, "2.3");

      expect(tasks2[0].checked).toBe(false);
      expect(tasks2[1].checked).toBe(true);
      expect(tasks2[2].checked).toBe(false);
    });

    it("handles multiple sections in full flow", async () => {
      const content = `# Story 2.3

## Acceptance Criteria

- [ ] AC1: Feature works

## Tasks / Subtasks

- [ ] Task 1: Implement feature
- [ ] Task 2: Write tests

## Implementation Notes

- [ ] Fix: Security issue
`;
      writeFileSync(storyPath, content);

      const tasks = parseBmadTasks(content, "2.3");
      expect(tasks).toHaveLength(4);
      expect(tasks[0].section).toBe("ac");
      expect(tasks[1].section).toBe("tasks");
      expect(tasks[2].section).toBe("tasks");
      expect(tasks[3].section).toBe("impl-notes");

      const todos = bmadTasksToTodos(tasks);
      expect(todos[0].content).toContain("[2.3ΔAC1]");
      expect(todos[1].content).toContain("[2.3ΔTask1]");
      expect(todos[2].content).toContain("[2.3ΔTask2]");
      expect(todos[3].content).toContain("[2.3ΔFix1]");

      await updateBmadCheckbox(storyPath, tasks[1].lineNumber, true);
      await updateBmadCheckbox(storyPath, tasks[3].lineNumber, true);

      const updatedContent = readFileSync(storyPath, "utf-8");
      const updatedTasks = parseBmadTasks(updatedContent, "2.3");

      expect(updatedTasks[0].checked).toBe(false);
      expect(updatedTasks[1].checked).toBe(true);
      expect(updatedTasks[2].checked).toBe(false);
      expect(updatedTasks[3].checked).toBe(true);
    });
  });

  describe("content-based matching", () => {
    it("finds checkbox after line number shift", async () => {
      const content = `# Story 2.3

## Acceptance Criteria

- [ ] AC1: Implement login endpoint
- [ ] AC2: Add password hashing
`;
      writeFileSync(storyPath, content);

      const originalLine = 5;

      const modifiedContent = `# Story 2.3

## New Section

Some new content here.
More content.

## Acceptance Criteria

- [ ] AC1: Implement login endpoint
- [ ] AC2: Add password hashing
`;
      writeFileSync(storyPath, modifiedContent);

      const foundLine = await findCheckboxLine(storyPath, "Implement login endpoint", originalLine);

      expect(foundLine).not.toBeNull();
      expect(foundLine).not.toBe(originalLine);
      expect(foundLine).toBeGreaterThan(originalLine);
    });

    it("handles exact content matching", async () => {
      const content = `## Acceptance Criteria

- [ ] Users can login with email and password
- [ ] Users can logout
`;
      writeFileSync(storyPath, content);

      const found = await findCheckboxLine(
        storyPath,
        "Users can login with email and password",
        2
      );

      expect(found).toBe(2);
    });

    it("handles partial content matching", async () => {
      const content = `## Acceptance Criteria

- [ ] Users can login with email and password
`;
      writeFileSync(storyPath, content);

      const found = await findCheckboxLine(storyPath, "login with email", 2);

      expect(found).toBe(2);
    });

    it("handles fuzzy matching for similar content", async () => {
      const content = `## Acceptance Criteria

- [ ] Implement the user login functionality
`;
      writeFileSync(storyPath, content);

      const found = await findCheckboxLine(storyPath, "user login functionality", 2);

      expect(found).toBe(2);
    });

    it("returns null when checkbox not found", async () => {
      const content = `## Acceptance Criteria

- [ ] Completely different task
`;
      writeFileSync(storyPath, content);

      const found = await findCheckboxLine(storyPath, "nonexistent task description xyz", 2);

      expect(found).toBeNull();
    });
  });

  describe("checkbox update", () => {
    it("checks unchecked checkbox", async () => {
      const content = `## Tasks

- [ ] First task
- [ ] Second task
`;
      writeFileSync(storyPath, content);

      const result = await updateBmadCheckbox(storyPath, 2, true);

      expect(result).toBe(true);
      const updated = readFileSync(storyPath, "utf-8");
      expect(updated).toContain("- [x] First task");
      expect(updated).toContain("- [ ] Second task");
    });

    it("unchecks checked checkbox", async () => {
      const content = `## Tasks

- [x] First task
- [ ] Second task
`;
      writeFileSync(storyPath, content);

      const result = await updateBmadCheckbox(storyPath, 2, false);

      expect(result).toBe(true);
      const updated = readFileSync(storyPath, "utf-8");
      expect(updated).toContain("- [ ] First task");
    });

    it("handles uppercase X checkbox", async () => {
      const content = `## Tasks

- [X] First task
`;
      writeFileSync(storyPath, content);

      const result = await updateBmadCheckbox(storyPath, 2, false);

      expect(result).toBe(true);
      const updated = readFileSync(storyPath, "utf-8");
      expect(updated).toContain("- [ ] First task");
    });

    it("returns false for invalid line number", async () => {
      const content = `## Tasks

- [ ] First task
`;
      writeFileSync(storyPath, content);

      const result = await updateBmadCheckbox(storyPath, 999, true);

      expect(result).toBe(false);
    });

    it("returns false for non-checkbox line", async () => {
      const content = `## Tasks

Regular text line
- [ ] First task
`;
      writeFileSync(storyPath, content);

      const result = await updateBmadCheckbox(storyPath, 2, true);

      expect(result).toBe(false);
    });
  });

  describe("subtask handling", () => {
    it("preserves subtask indentation in todos", async () => {
      const content = `## Tasks / Subtasks

- [ ] Parent task
  - [ ] Subtask 1.1
  - [ ] Subtask 1.2
- [ ] Another parent
`;
      writeFileSync(storyPath, content);

      const tasks = parseBmadTasks(content, "2.3");
      const todos = bmadTasksToTodos(tasks);

      expect(tasks[0].indent).toBe(0);
      expect(tasks[1].indent).toBe(2);
      expect(tasks[2].indent).toBe(2);
      expect(tasks[3].indent).toBe(0);

      expect(todos[1].content).toMatch(/^\s+\[2\.3ΔTask2\]/);
    });

    it("updates subtask checkbox correctly", async () => {
      const content = `## Tasks / Subtasks

- [ ] Parent task
  - [ ] Subtask 1.1
  - [ ] Subtask 1.2
`;
      writeFileSync(storyPath, content);

      const tasks = parseBmadTasks(content, "2.3");
      const subtaskLine = tasks[1].lineNumber;

      await updateBmadCheckbox(storyPath, subtaskLine, true);

      const updated = readFileSync(storyPath, "utf-8");
      expect(updated).toContain("- [ ] Parent task");
      expect(updated).toContain("  - [x] Subtask 1.1");
      expect(updated).toContain("  - [ ] Subtask 1.2");
    });
  });

  describe("priority detection", () => {
    it("detects critical priority", async () => {
      const content = `## Implementation Notes

- [ ] Critical: Fix security issue - Priority: Critical
`;
      writeFileSync(storyPath, content);

      const tasks = parseBmadTasks(content, "2.3");
      expect(tasks[0].priority).toBe("high");
    });

    it("detects low priority", async () => {
      const content = `## Implementation Notes

- [ ] Could improve logging - Priority: Low
`;
      writeFileSync(storyPath, content);

      const tasks = parseBmadTasks(content, "2.3");
      expect(tasks[0].priority).toBe("low");
    });

    it("uses section-based default priority", async () => {
      const content = `## Acceptance Criteria

- [ ] AC without explicit priority

## Tasks / Subtasks

- [ ] Task without explicit priority
`;
      writeFileSync(storyPath, content);

      const tasks = parseBmadTasks(content, "2.3");
      expect(tasks[0].priority).toBe("high");
      expect(tasks[1].priority).toBe("medium");
    });
  });
});
