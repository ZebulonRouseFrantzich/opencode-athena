import { describe, it, expect, beforeEach, vi } from "vitest";
import { createCompactionHook } from "../../src/plugin/hooks/compaction-hook.js";
import type { AthenaConfig, OpenCodeTodo } from "../../src/shared/types.js";
import { StoryTracker } from "../../src/plugin/tracker/story-tracker.js";

describe("compaction-hook", () => {
  let tracker: StoryTracker;
  let config: AthenaConfig;

  beforeEach(() => {
    tracker = {
      getCurrentStoryContext: vi.fn(),
      getCurrentTodos: vi.fn(),
      getCurrentStory: vi.fn(),
    } as unknown as StoryTracker;

    config = {
      bmad: {
        paths: {
          stories: "docs/stories",
        },
      },
      features: {
        todoSync: true,
      },
    } as AthenaConfig;
  });

  describe("post-compaction protocol", () => {
    it("includes mandatory post-compaction protocol when todos exist", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "2.3:ac:5", content: "[2.3ΔAC1] Implement login", status: "pending", priority: "high" },
        { id: "2.3:ac:6", content: "[2.3ΔAC2] Add logout", status: "in_progress", priority: "high" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("⚠️ MANDATORY POST-COMPACTION PROTOCOL");
      expect(context).toContain("STOP. Before doing ANYTHING else:");
      expect(context).toContain("Call `todoread` to get your current task list");
    });

    it("does not include protocol when all todos are completed", async () => {
      const todos: OpenCodeTodo[] = [
        {
          id: "2.3:ac:5",
          content: "[2.3ΔAC1] Implement login",
          status: "completed",
          priority: "high",
        },
        {
          id: "2.3:ac:6",
          content: "[2.3ΔAC2] Add logout",
          status: "completed",
          priority: "high",
        },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).not.toContain("⚠️ MANDATORY POST-COMPACTION PROTOCOL");
    });

    it("does not include protocol when no BMAD todos exist", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "user-1", content: "Regular user todo", status: "pending", priority: "medium" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).not.toContain("⚠️ MANDATORY POST-COMPACTION PROTOCOL");
    });
  });

  describe("in_progress todos", () => {
    it("lists in_progress todos with warning", async () => {
      const todos: OpenCodeTodo[] = [
        {
          id: "2.3:ac:5",
          content: "[2.3ΔAC1] Implement login endpoint",
          status: "in_progress",
          priority: "high",
        },
        {
          id: "2.3:ac:6",
          content: "[2.3ΔAC2] Add password hashing",
          status: "in_progress",
          priority: "high",
        },
        { id: "2.3:ac:7", content: "[2.3ΔAC3] Return JWT", status: "pending", priority: "medium" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("🔄 IN PROGRESS (Complete these FIRST):");
      expect(context).toContain("[2.3ΔAC1] Implement login endpoint");
      expect(context).toContain("[2.3ΔAC2] Add password hashing");
    });

    it("shows in_progress section before pending section", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "2.3:ac:5", content: "[2.3ΔAC1] First task", status: "pending", priority: "high" },
        { id: "2.3:ac:6", content: "[2.3ΔAC2] Second task", status: "in_progress", priority: "high" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      const inProgressIndex = context.indexOf("🔄 IN PROGRESS");
      const pendingIndex = context.indexOf("⏳ PENDING");

      expect(inProgressIndex).toBeGreaterThan(-1);
      expect(pendingIndex).toBeGreaterThan(-1);
      expect(inProgressIndex).toBeLessThan(pendingIndex);
    });
  });

  describe("pending todos", () => {
    it("lists pending todos sorted by priority", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "2.3:ac:5", content: "[2.3ΔAC1] Low priority task", status: "pending", priority: "low" },
        {
          id: "2.3:ac:6",
          content: "[2.3ΔAC2] High priority task",
          status: "pending",
          priority: "high",
        },
        {
          id: "2.3:ac:7",
          content: "[2.3ΔAC3] Medium priority task",
          status: "pending",
          priority: "medium",
        },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("⏳ PENDING (Work queue):");

      const highIndex = context.indexOf("🔴 [2.3ΔAC2] High priority task");
      const mediumIndex = context.indexOf("🟡 [2.3ΔAC3] Medium priority task");
      const lowIndex = context.indexOf("🟢 [2.3ΔAC1] Low priority task");

      expect(highIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(lowIndex);
    });

    it("shows only top 10 pending todos when more than 10 exist", async () => {
      const todos: OpenCodeTodo[] = Array.from({ length: 15 }, (_, i) => ({
        id: `2.3:ac:${i}`,
        content: `[2.3ΔAC${i + 1}] Task ${i + 1}`,
        status: "pending" as const,
        priority: "medium" as const,
      }));

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("... and 5 more (call todoread for full list)");
      expect(context).toContain("[2.3ΔAC1] Task 1");
      expect(context).toContain("[2.3ΔAC10] Task 10");
      expect(context).not.toContain("[2.3ΔAC11] Task 11");
    });

    it("uses correct priority icons", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "1", content: "[2.3ΔAC1] High", status: "pending", priority: "high" },
        { id: "2", content: "[2.3ΔAC2] Medium", status: "pending", priority: "medium" },
        { id: "3", content: "[2.3ΔAC3] Low", status: "pending", priority: "low" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("🔴 [2.3ΔAC1] High");
      expect(context).toContain("🟡 [2.3ΔAC2] Medium");
      expect(context).toContain("🟢 [2.3ΔAC3] Low");
    });
  });

  describe("verification required", () => {
    it("includes verification step when todos exist", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "2.3:ac:5", content: "[2.3ΔAC1] Task", status: "pending", priority: "high" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("✅ VERIFICATION REQUIRED");
      expect(context).toContain("Call `todoread` NOW to confirm this matches your working state.");
      expect(context).toContain(
        "If it doesn't match, the todo list takes priority over any 'next steps' in this summary."
      );
    });
  });

  describe("protocol ordering", () => {
    it("shows post-compaction protocol before story context", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "2.3:ac:5", content: "[2.3ΔAC1] Task", status: "pending", priority: "high" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(
        "Current Story: 2.3\nStatus: in_progress"
      );
      vi.mocked(tracker.getCurrentStory).mockReturnValue({
        id: "2.3",
        content: "Story content",
        status: "in_progress",
        startedAt: "2025-01-01",
      });

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      const protocolIndex = context.indexOf("⚠️ MANDATORY POST-COMPACTION PROTOCOL");
      const storyContextIndex = context.indexOf("OpenCode Athena - Current BMAD Story Context");

      expect(protocolIndex).toBeGreaterThan(-1);
      expect(storyContextIndex).toBeGreaterThan(-1);
      expect(protocolIndex).toBeLessThan(storyContextIndex);
    });

    it("shows separator line between protocol and story context", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "2.3:ac:5", content: "[2.3ΔAC1] Task", status: "pending", priority: "high" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(
        "Current Story: 2.3\nStatus: in_progress"
      );

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("---");
    });
  });

  describe("existing functionality preservation", () => {
    it("still includes story context when available", async () => {
      vi.mocked(tracker.getCurrentTodos).mockReturnValue([]);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(
        "Current Story: 2.3\nStatus: in_progress"
      );
      vi.mocked(tracker.getCurrentStory).mockReturnValue({
        id: "2.3",
        content: "Story content",
        status: "in_progress",
        startedAt: "2025-01-01",
      });

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("OpenCode Athena - Current BMAD Story Context");
      expect(context).toContain("Current Story: 2.3");
    });

    it("still includes todo sync documentation", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "2.3:ac:5", content: "[2.3ΔAC1] Task", status: "pending", priority: "high" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("Todo Sync (BMAD ↔ Todos)");
      expect(context).toContain("Format: `[{storyId}Δ{section}] {task}`");
    });

    it("still includes important instructions", async () => {
      const todos: OpenCodeTodo[] = [
        { id: "2.3:ac:5", content: "[2.3ΔAC1] Task", status: "pending", priority: "high" },
      ];

      vi.mocked(tracker.getCurrentTodos).mockReturnValue(todos);
      vi.mocked(tracker.getCurrentStoryContext).mockResolvedValue(null);
      vi.mocked(tracker.getCurrentStory).mockReturnValue(null);

      const hook = createCompactionHook(tracker, config, "/test/project");
      const output = { context: [] as string[] };

      await hook({ sessionID: "test" }, output);

      const context = output.context.join("\n");
      expect(context).toContain("Use athena_get_story to reload full context");
      expect(context).toContain("Use athena_update_status to update the story status");
    });
  });
});
