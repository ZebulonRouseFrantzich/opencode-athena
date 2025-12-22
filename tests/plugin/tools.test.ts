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
}));

vi.mock("../../src/plugin/utils/yaml-handler.js", () => ({
  readSprintStatus: vi.fn(),
  writeSprintStatus: vi.fn(),
}));

vi.mock("../../src/plugin/utils/bmad-finder.js", () => ({
  findBmadDir: vi.fn(),
  getBmadPaths: vi.fn(),
}));

vi.mock("../../src/plugin/utils/notifications.js", () => ({
  sendNotification: vi.fn(),
}));

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { readSprintStatus, writeSprintStatus } from "../../src/plugin/utils/yaml-handler.js";
import { findBmadDir, getBmadPaths } from "../../src/plugin/utils/bmad-finder.js";
import type { SprintStatus, AthenaConfig, TrackedStory } from "../../src/shared/types.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFile);
const mockReadSprintStatus = vi.mocked(readSprintStatus);
const mockWriteSprintStatus = vi.mocked(writeSprintStatus);
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
    mockReadSprintStatus.mockResolvedValue(null);

    const { createGetStoryTool } = await import("../../src/plugin/tools/get-story.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createGetStoryTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute({}, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe("No sprint-status.yaml found");
  });

  it("should load story when sprint has pending stories", async () => {
    const sprint: SprintStatus = {
      current_epic: "Epic 2",
      completed_stories: ["2.1"],
      pending_stories: ["2.2", "2.3"],
      in_progress_stories: [],
      blocked_stories: [],
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
    mockReadSprintStatus.mockResolvedValue(sprint);
    mockExistsSync.mockImplementation((path) => {
      if (typeof path === "string" && path.includes("story-2-2.md")) return true;
      return false;
    });
    mockReadFile.mockResolvedValue("# Story 2.2\n\nImplement feature X");

    const { createGetStoryTool } = await import("../../src/plugin/tools/get-story.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createGetStoryTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute({}, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.storyId).toBe("2.2");
    expect(parsed.story).toContain("Story 2.2");
    expect(tracker.setCurrentStory).toHaveBeenCalledWith("2.2", expect.any(Object));
  });
});

describe("athena_update_status tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should require completionSummary when status is completed", async () => {
    const { createUpdateStatusTool } = await import("../../src/plugin/tools/update-status.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createUpdateStatusTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute(
      { storyId: "2.3", status: "completed" },
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
    const sprint: SprintStatus = {
      completed_stories: [],
      pending_stories: ["2.3"],
      in_progress_stories: [],
      blocked_stories: [],
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
    mockReadSprintStatus.mockResolvedValue(sprint);
    mockWriteSprintStatus.mockResolvedValue(undefined);

    const { createUpdateStatusTool } = await import("../../src/plugin/tools/update-status.js");
    const ctx = createMockContext();
    const tracker = createMockTracker();

    const tool = createUpdateStatusTool(ctx as any, tracker as any, defaultConfig);
    const result = await tool.execute(
      { storyId: "2.3", status: "completed", completionSummary: "Implemented feature" },
      {} as any
    );
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.newStatus).toBe("completed");
    expect(mockWriteSprintStatus).toHaveBeenCalled();
    expect(tracker.updateStoryStatus).toHaveBeenCalledWith("2.3", "completed");
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
      status: "in_progress",
      startedAt: "2024-01-01T00:00:00.000Z",
    };

    tracker.getCurrentStory.mockReturnValue(currentStory);
    tracker.getCurrentStoryContext.mockResolvedValue("Story context...");

    const tool = createGetContextTool(tracker as any, defaultConfig);
    const result = await tool.execute({}, {} as any);
    const parsed = JSON.parse(result);

    expect(parsed.currentStory.id).toBe("2.3");
    expect(parsed.currentStory.status).toBe("in_progress");
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
