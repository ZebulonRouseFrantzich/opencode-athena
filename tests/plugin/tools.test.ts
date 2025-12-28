/**
 * Tests for plugin tools
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock zod for tool.schema
const mockZodString = () => ({
  optional: () => ({ describe: () => ({}) }),
  describe: () => ({}),
});

const mockZodEnum = () => ({
  optional: () => ({ describe: () => ({}) }),
  describe: () => ({}),
});

const mockZodArray = () => ({
  describe: () => ({}),
});

const mockZodBoolean = () => ({
  optional: () => ({ describe: () => ({}) }),
  describe: () => ({}),
});

const mockSchema = {
  string: mockZodString,
  enum: mockZodEnum,
  array: mockZodArray,
  boolean: mockZodBoolean,
};

// Mock @opencode-ai/plugin before any imports that use it
vi.mock("@opencode-ai/plugin", () => {
  const toolFn = (config: any) => ({
    description: config.description,
    args: config.args,
    execute: config.execute,
  });
  toolFn.schema = mockSchema;
  return { tool: toolFn };
});

// Mock fs modules
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("../../src/plugin/utils/yaml-handler.js", () => ({
  readSprintStatus: vi.fn(),
  writeSprintStatus: vi.fn(),
  readBmadSprintStatus: vi.fn(),
  writeBmadSprintStatus: vi.fn(),
  updateStoryStatus: vi.fn(),
  findNextReadyStory: vi.fn(),
  findStoryInStatus: vi.fn(),
  updateEpicStatusIfNeeded: vi.fn(),
  calculateSprintProgress: vi.fn(),
  parseStoryKey: vi.fn(),
  storyIdToDotFormat: vi.fn((id: string) => id.replace("-", ".")),
}));

vi.mock("../../src/plugin/utils/bmad-finder.js", () => ({
  findBmadDir: vi.fn(),
  getBmadPaths: vi.fn(),
}));

vi.mock("../../src/plugin/utils/notifications.js", () => ({
  sendNotification: vi.fn(),
}));

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import {
  readSprintStatus,
  writeSprintStatus,
  readBmadSprintStatus,
  writeBmadSprintStatus,
  updateStoryStatus,
  findNextReadyStory,
  findStoryInStatus,
  updateEpicStatusIfNeeded,
  calculateSprintProgress,
  parseStoryKey,
} from "../../src/plugin/utils/yaml-handler.js";
import { findBmadDir, getBmadPaths } from "../../src/plugin/utils/bmad-finder.js";
import type { SprintStatus, BmadSprintStatus, AthenaConfig, TrackedStory } from "../../src/shared/types.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockReadSprintStatus = vi.mocked(readSprintStatus);
const mockWriteSprintStatus = vi.mocked(writeSprintStatus);
const mockReadBmadSprintStatus = vi.mocked(readBmadSprintStatus);
const mockWriteBmadSprintStatus = vi.mocked(writeBmadSprintStatus);
const mockUpdateStoryStatus = vi.mocked(updateStoryStatus);
const mockFindNextReadyStory = vi.mocked(findNextReadyStory);
const mockFindStoryInStatus = vi.mocked(findStoryInStatus);
const mockUpdateEpicStatusIfNeeded = vi.mocked(updateEpicStatusIfNeeded);
const mockCalculateSprintProgress = vi.mocked(calculateSprintProgress);
const mockParseStoryKey = vi.mocked(parseStoryKey);
const mockFindBmadDir = vi.mocked(findBmadDir);
const mockGetBmadPaths = vi.mocked(getBmadPaths);

// Mock tracker
const createMockTracker = () => ({
  getCurrentStory: vi.fn(),
  setCurrentStory: vi.fn(),
  updateStoryStatus: vi.fn(),
  clearCurrentStory: vi.fn(),
  getSessionId: vi.fn().mockReturnValue("test-session"),
  getHistory: vi.fn().mockReturnValue([]),
  getCurrentStoryContext: vi.fn(),
  initialize: vi.fn(),
});

// Mock plugin context
const createMockContext = () => ({
  directory: "/test/project",
  worktree: "/test/project",
  project: { name: "test-project" },
  client: {},
  $: vi.fn(),
});

// Default config
const defaultConfig: AthenaConfig = {
  version: "0.0.1",
  subscriptions: {
    claude: { enabled: true, tier: "max5x" },
    openai: { enabled: false },
    google: { enabled: false, authMethod: "none" },
    githubCopilot: { enabled: false, plan: "none" },
  },
  models: {
    sisyphus: "anthropic/claude-sonnet-4",
    oracle: "anthropic/claude-sonnet-4",
    librarian: "anthropic/claude-sonnet-4",
  },
  bmad: {
    defaultTrack: "bmad-method",
    autoStatusUpdate: true,
    parallelStoryLimit: 3,
  },
  features: {
    bmadBridge: true,
    autoStatus: true,
    parallelExecution: true,
    notifications: true,
    contextMonitor: true,
    commentChecker: true,
    lspTools: true,
    autoGitOperations: false,
    todoSync: true,
  },
  mcps: {
    context7: true,
    exa: true,
    grepApp: true,
  },
};

describe("athena_get_story tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error when BMAD directory not found", async () => {
    mockFindBmadDir.mockResolvedValue(null);
    mockGetBmadPaths.mockResolvedValue({
      projectRoot: "/test/project",
      bmadDir: null,
      planningDir: "/test/project/docs/project-planning-artifacts",
      implementationDir: "/test/project/docs/implementation-artifacts",
      storiesDir: "/test/project/docs/implementation-artifacts/stories",
      sprintStatus: "/test/project/docs/implementation-artifacts/sprint-status.yaml",
      architecture: "/test/project/docs/project-planning-artifacts/architecture.md",
      prd: "/test/project/docs/project-planning-artifacts/PRD.md",
      epics: "/test/project/docs/project-planning-artifacts/epics.md",
    });

    const { createGetStoryTool } = await import("../../src/plugin/tools/get-story.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createGetStoryTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute({}, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe("No BMAD directory found");
    expect(parsed.suggestion).toContain("npx bmad-method");
  });

  it("should return error when sprint-status.yaml not found", async () => {
    mockFindBmadDir.mockResolvedValue("/test/project/docs");
    mockGetBmadPaths.mockResolvedValue({
      projectRoot: "/test/project",
      bmadDir: "/test/project/docs",
      planningDir: "/test/project/docs/project-planning-artifacts",
      implementationDir: "/test/project/docs/implementation-artifacts",
      storiesDir: "/test/project/docs/implementation-artifacts/stories",
      sprintStatus: "/test/project/docs/implementation-artifacts/sprint-status.yaml",
      architecture: "/test/project/docs/project-planning-artifacts/architecture.md",
      prd: "/test/project/docs/project-planning-artifacts/PRD.md",
      epics: "/test/project/docs/project-planning-artifacts/epics.md",
    });
    mockReadBmadSprintStatus.mockResolvedValue(null);

    const { createGetStoryTool } = await import("../../src/plugin/tools/get-story.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createGetStoryTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute({}, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe("No sprint-status.yaml found");
  });

  it("should load story when sprint has pending stories", async () => {
    const sprint: BmadSprintStatus = {
      development_status: {
        "epic-2": "in-progress",
        "2-1": "done",
        "2-2": "ready-for-dev",
        "2-3": "backlog",
      },
    };

    mockFindBmadDir.mockResolvedValue("/test/project/docs");
    mockGetBmadPaths.mockResolvedValue({
      projectRoot: "/test/project",
      bmadDir: "/test/project/docs",
      planningDir: "/test/project/docs/project-planning-artifacts",
      implementationDir: "/test/project/docs/implementation-artifacts",
      storiesDir: "/test/project/docs/implementation-artifacts/stories",
      sprintStatus: "/test/project/docs/implementation-artifacts/sprint-status.yaml",
      architecture: "/test/project/docs/project-planning-artifacts/architecture.md",
      prd: "/test/project/docs/project-planning-artifacts/PRD.md",
      epics: "/test/project/docs/project-planning-artifacts/epics.md",
    });
    mockReadBmadSprintStatus.mockResolvedValue(sprint);
    mockFindNextReadyStory.mockReturnValue({
      key: "2-2",
      status: "ready-for-dev",
      parsed: { epicNum: "2", storyNum: "2", normalizedId: "2-2", fullKey: "2-2" },
    });
    mockUpdateStoryStatus.mockResolvedValue({ success: true, key: "2-2" });
    mockCalculateSprintProgress.mockReturnValue({
      total: 3,
      done: 1,
      inProgress: 0,
      readyForDev: 1,
      backlog: 1,
      blocked: 0,
      review: 0,
      percentComplete: 33,
    });
    mockExistsSync.mockImplementation((path) => {
      if (typeof path === "string" && path.includes("story-2-2.md")) return true;
      if (typeof path === "string" && path.includes("stories")) return true;
      return false;
    });
    mockReaddir.mockResolvedValue(["story-2-2.md"] as never);
    mockReadFile.mockResolvedValue("# Story 2.2\n\nImplement feature X");

    const { createGetStoryTool } = await import("../../src/plugin/tools/get-story.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createGetStoryTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute({}, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.storyId).toBe("2.2");
    expect(parsed.story).toContain("Story 2.2");
    expect(tracker.setCurrentStory).toHaveBeenCalledWith("2-2", expect.any(Object));
  });
});

describe("athena_update_status tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should require completionSummary when status is done", async () => {
    const { createUpdateStatusTool } = await import("../../src/plugin/tools/update-status.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createUpdateStatusTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute(
      { storyId: "2.3", status: "done" },
      {} as any
    );
    const parsed = JSON.parse(result);

    expect(parsed.error).toContain("completionSummary is required");
  });

  it("should require notes when status is blocked", async () => {
    const { createUpdateStatusTool } = await import("../../src/plugin/tools/update-status.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createUpdateStatusTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute(
      { storyId: "2.3", status: "blocked" },
      {} as any
    );
    const parsed = JSON.parse(result);

    expect(parsed.error).toContain("notes are required");
  });

  it("should update sprint status successfully", async () => {
    const sprint: BmadSprintStatus = {
      development_status: {
        "2-3": "in-progress",
      },
    };

    mockFindBmadDir.mockResolvedValue("/test/project/docs");
    mockGetBmadPaths.mockResolvedValue({
      projectRoot: "/test/project",
      bmadDir: "/test/project/docs",
      planningDir: "/test/project/docs/project-planning-artifacts",
      implementationDir: "/test/project/docs/implementation-artifacts",
      storiesDir: "/test/project/docs/implementation-artifacts/stories",
      sprintStatus: "/test/project/docs/implementation-artifacts/sprint-status.yaml",
      architecture: "/test/project/docs/project-planning-artifacts/architecture.md",
      prd: "/test/project/docs/project-planning-artifacts/PRD.md",
      epics: "/test/project/docs/project-planning-artifacts/epics.md",
    });
    mockExistsSync.mockReturnValue(true);
    mockReadBmadSprintStatus.mockResolvedValue(sprint);
    mockFindStoryInStatus.mockReturnValue({
      key: "2-3",
      status: "in-progress",
      parsed: { epicNum: "2", storyNum: "3", normalizedId: "2-3", fullKey: "2-3" },
    });
    mockUpdateStoryStatus.mockResolvedValue({ success: true, key: "2-3", previousStatus: "in-progress" });
    mockUpdateEpicStatusIfNeeded.mockResolvedValue({ updated: false });
    mockParseStoryKey.mockReturnValue({ epicNum: "2", storyNum: "3", normalizedId: "2-3", fullKey: "2-3" });

    const { createUpdateStatusTool } = await import("../../src/plugin/tools/update-status.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createUpdateStatusTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute(
      { storyId: "2.3", status: "done", completionSummary: "Implemented feature" },
      {} as any
    );
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.newStatus).toBe("done");
    expect(mockUpdateStoryStatus).toHaveBeenCalled();
    expect(tracker.updateStoryStatus).toHaveBeenCalledWith("2.3", "done");
  });
});

describe("athena_get_context tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return no_active_story when no story is tracked", async () => {
    const { createGetContextTool } = await import("../../src/plugin/tools/get-context.js");
    const tracker = createMockTracker();
    tracker.getCurrentStory.mockReturnValue(null);

    const tool = createGetContextTool(tracker as any, defaultConfig);
    const result = await tool.execute({}, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("no_active_story");
  });

  it("should return current story context when story is tracked", async () => {
    const { createGetContextTool } = await import("../../src/plugin/tools/get-context.js");
    const tracker = createMockTracker();

    const currentStory: TrackedStory = {
      id: "2.3",
      content: "Test story",
      status: "in-progress",
      startedAt: "2024-01-01T00:00:00.000Z",
    };

    tracker.getCurrentStory.mockReturnValue(currentStory);
    tracker.getCurrentStoryContext.mockResolvedValue("Story context...");

    const tool = createGetContextTool(tracker as any, defaultConfig);
    const result = await tool.execute({}, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.currentStory.id).toBe("2.3");
    expect(parsed.currentStory.status).toBe("in-progress");
  });
});

describe("athena_parallel tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return not implemented message", async () => {
    const { createParallelTool } = await import("../../src/plugin/tools/parallel.js");

    const tool = createParallelTool();
    const result = await tool.execute(
      { storyIds: ["2.3", "2.4"] },
      {} as any
    );
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe("Not implemented");
    expect(parsed.requestedStories).toEqual(["2.3", "2.4"]);
  });
});

describe("athena_config tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return full config when section is all", async () => {
    const { createConfigTool } = await import("../../src/plugin/tools/config.js");

    const tool = createConfigTool(defaultConfig);
    const result = await tool.execute({}, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.subscriptions).toBeDefined();
    expect(parsed.models).toBeDefined();
    expect(parsed.bmad).toBeDefined();
    expect(parsed.features).toBeDefined();
  });

  it("should return specific section when requested", async () => {
    const { createConfigTool } = await import("../../src/plugin/tools/config.js");

    const tool = createConfigTool(defaultConfig);
    const result = await tool.execute({ section: "bmad" }, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.section).toBe("bmad");
    expect(parsed.data).toEqual(defaultConfig.bmad);
  });
});
