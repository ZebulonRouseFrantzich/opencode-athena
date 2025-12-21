/**
 * Tests for StoryTracker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StoryTracker } from "../../src/plugin/tracker/story-tracker.js";

// Mock fs modules
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

describe("StoryTracker", () => {
  const projectDir = "/test/project";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing state file
    mockExistsSync.mockReturnValue(false);
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialize", () => {
    it("should start with empty state when no state file exists", async () => {
      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      expect(tracker.getCurrentStory()).toBeNull();
      expect(tracker.getHistory()).toEqual([]);
    });

    it("should restore state from file if project matches", async () => {
      const savedState = {
        currentStory: {
          id: "2.3",
          content: "Test story",
          status: "in_progress",
          startedAt: "2024-01-01T00:00:00.000Z",
        },
        sessionId: "old-session",
        projectDir: projectDir,
        history: [{ storyId: "2.3", status: "in_progress", timestamp: "2024-01-01T00:00:00.000Z" }],
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify(savedState));

      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      expect(tracker.getCurrentStory()?.id).toBe("2.3");
      expect(tracker.getCurrentStory()?.status).toBe("in_progress");
      // Session ID should be regenerated
      expect(tracker.getSessionId()).not.toBe("old-session");
    });

    it("should not restore state if project directory differs", async () => {
      const savedState = {
        currentStory: { id: "2.3", content: "Test", status: "in_progress", startedAt: "2024-01-01" },
        sessionId: "old-session",
        projectDir: "/different/project",
        history: [],
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify(savedState));

      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      expect(tracker.getCurrentStory()).toBeNull();
    });
  });

  describe("setCurrentStory", () => {
    it("should set the current story and add to history", async () => {
      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      await tracker.setCurrentStory("2.3", {
        content: "Test story content",
        status: "in_progress",
        startedAt: "2024-01-01T00:00:00.000Z",
      });

      const story = tracker.getCurrentStory();
      expect(story?.id).toBe("2.3");
      expect(story?.status).toBe("in_progress");

      const history = tracker.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].storyId).toBe("2.3");
    });

    it("should persist state to disk", async () => {
      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      await tracker.setCurrentStory("2.3", {
        content: "Test",
        status: "in_progress",
        startedAt: "2024-01-01",
      });

      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  describe("updateStoryStatus", () => {
    it("should update status of current story", async () => {
      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      await tracker.setCurrentStory("2.3", {
        content: "Test",
        status: "in_progress",
        startedAt: "2024-01-01",
      });

      await tracker.updateStoryStatus("2.3", "completed");

      const story = tracker.getCurrentStory();
      expect(story?.status).toBe("completed");
      expect(story?.completedAt).toBeDefined();
    });

    it("should add entry to history", async () => {
      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      await tracker.setCurrentStory("2.3", {
        content: "Test",
        status: "in_progress",
        startedAt: "2024-01-01",
      });

      await tracker.updateStoryStatus("2.3", "completed");

      const history = tracker.getHistory();
      expect(history.length).toBe(2);
      expect(history[1].status).toBe("completed");
    });
  });

  describe("getCurrentStoryContext", () => {
    it("should return null when no story is tracked", async () => {
      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      const context = await tracker.getCurrentStoryContext();
      expect(context).toBeNull();
    });

    it("should return formatted context when story is tracked", async () => {
      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      await tracker.setCurrentStory("2.3", {
        content: "Test story",
        status: "in_progress",
        startedAt: "2024-01-01T00:00:00.000Z",
      });

      const context = await tracker.getCurrentStoryContext();
      expect(context).toContain("Current Story: 2.3");
      expect(context).toContain("Status: in_progress");
    });
  });

  describe("clearCurrentStory", () => {
    it("should clear the current story", async () => {
      const tracker = new StoryTracker(projectDir);
      await tracker.initialize();

      await tracker.setCurrentStory("2.3", {
        content: "Test",
        status: "in_progress",
        startedAt: "2024-01-01",
      });

      await tracker.clearCurrentStory();

      expect(tracker.getCurrentStory()).toBeNull();
    });
  });
});
