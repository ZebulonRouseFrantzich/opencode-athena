/**
 * Tests for BMAD path detection and finder utilities
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AthenaConfig } from "../../src/shared/types.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("yaml", () => ({
  parse: vi.fn(),
}));

vi.mock("fdir", () => ({
  fdir: vi.fn(() => ({
    withMaxDepth: vi.fn().mockReturnThis(),
    withBasePath: vi.fn().mockReturnThis(),
    exclude: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    crawl: vi.fn().mockReturnThis(),
    withPromise: vi.fn().mockResolvedValue([]),
  })),
}));

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { getBmadPaths } from "../../src/plugin/utils/bmad-finder.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReaddir = vi.mocked(readdir);

describe("bmad-finder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReaddir.mockResolvedValue([]);
  });

  describe("getBmadPaths - story detection", () => {
    it("should detect nested structure when stories/  contains story files", async () => {
      const projectRoot = "/test/project";

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/docs")) return true;
        if (pathStr.includes("/stories")) return true;
        return false;
      }) as any);

      mockReaddir.mockImplementation((async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/stories")) {
          return ["story-2-1.md", "story-2-2.md"] as any;
        }
        return [] as any;
      }) as any);

      const paths = await getBmadPaths(projectRoot);

      expect(paths.storiesDir).toContain("/stories");
      expect(paths.storiesDir).toMatch(/implementation-artifacts\/stories$/);
    });

    it("should detect flat structure when base dir contains story files", async () => {
      const projectRoot = "/test/project";

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/docs")) return true;
        if (pathStr.includes("/implementation-artifacts")) return true;
        if (pathStr.includes("/stories")) return false;
        return false;
      }) as any);

      mockReaddir.mockImplementation((async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/implementation-artifacts") && !pathStr.includes("/stories")) {
          return ["1-1.md", "2-3.md", "story-4-1.md"] as any;
        }
        if (pathStr.includes("/stories")) {
          return [] as any;
        }
        return [] as any;
      }) as any);

      const paths = await getBmadPaths(projectRoot);

      expect(paths.storiesDir).toBe(`${projectRoot}/docs/implementation-artifacts`);
      expect(paths.storiesDir).not.toMatch(/\/stories$/);
    });

    it("should use config override when bmad.paths.stories is set", async () => {
      const projectRoot = "/test/project";
      const config: AthenaConfig = {
        version: "0.8.1",
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
        models: {
          sisyphus: "test",
          oracle: "test",
          librarian: "test",
        },
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: true,
          parallelStoryLimit: 3,
          paths: {
            stories: "custom/stories/path",
          },
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
        },
        mcps: {
          context7: true,
          exa: true,
          grepApp: true,
        },
      };

      mockExistsSync.mockReturnValue(true);

      const paths = await getBmadPaths(projectRoot, config);

      expect(paths.storiesDir).toBe(`${projectRoot}/custom/stories/path`);
    });

    it("should default to nested structure when no stories found", async () => {
      const projectRoot = "/test/project";

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/docs")) return true;
        return false;
      }) as any);

      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot);

      expect(paths.storiesDir).toContain("/stories");
      expect(paths.storiesDir).toMatch(/implementation-artifacts\/stories$/);
    });

    it("should work across different BMAD v6 versions (nested structure)", async () => {
      const projectRoot = "/test/project";

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/docs")) return true;
        if (pathStr.includes("/implementation-artifacts")) return true;
        if (pathStr.includes("/stories")) return true;
        return false;
      }) as any);

      mockReaddir.mockImplementation((async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/stories")) {
          return ["3-1.md", "3-2.md"] as any;
        }
        return [] as any;
      }) as any);

      const paths = await getBmadPaths(projectRoot);

      expect(paths.storiesDir).toContain("/stories");
    });
  });

  describe("getBmadPaths - case-insensitive file search", () => {
    it("should find prd.md when PRD.md does not exist (lowercase variant)", async () => {
      const projectRoot = "/test/project";

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith("/PRD.md")) return false;
        if (pathStr.endsWith("/prd.md")) return true;
        if (pathStr.includes("/docs")) return true;
        return false;
      }) as any);

      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot);

      expect(paths.prd).toContain("/prd.md");
    });

    it("should find ARCHITECTURE.MD when architecture.md does not exist (uppercase variant)", async () => {
      const projectRoot = "/test/project";

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith("/architecture.md")) return false;
        if (pathStr.endsWith("/ARCHITECTURE.MD")) return true;
        if (pathStr.includes("/docs")) return true;
        return false;
      }) as any);

      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot);

      expect(paths.architecture).toContain("/ARCHITECTURE.MD");
    });

    it("should find Epics.md when epics.md does not exist (title case variant)", async () => {
      const projectRoot = "/test/project";

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith("/epics.md")) return false;
        if (pathStr.endsWith("/EPICS.MD")) return false;
        if (pathStr.endsWith("/Epics.md")) return true;
        if (pathStr.includes("/docs")) return true;
        return false;
      }) as any);

      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot);

      expect(paths.epics).toContain("/Epics.md");
    });

    it("should prefer exact match over case variants", async () => {
      const projectRoot = "/test/project";

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/docs")) return true;
        if (pathStr.endsWith("/PRD.md")) return true;
        if (pathStr.endsWith("/prd.md")) return true;
        return false;
      }) as any);

      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot);

      expect(paths.prd).toContain("/PRD.md");
    });
  });

  describe("getBmadPaths - config overrides", () => {
    it("should use sprintStatus config override", async () => {
      const projectRoot = "/test/project";
      const config: AthenaConfig = {
        version: "0.8.1",
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
        models: {
          sisyphus: "test",
          oracle: "test",
          librarian: "test",
        },
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: true,
          parallelStoryLimit: 3,
          paths: {
            sprintStatus: "custom/sprint-status.yaml",
          },
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
        },
        mcps: {
          context7: true,
          exa: true,
          grepApp: true,
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot, config);

      expect(paths.sprintStatus).toBe(`${projectRoot}/custom/sprint-status.yaml`);
    });

    it("should use prd config override", async () => {
      const projectRoot = "/test/project";
      const config: AthenaConfig = {
        version: "0.8.1",
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
        models: {
          sisyphus: "test",
          oracle: "test",
          librarian: "test",
        },
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: true,
          parallelStoryLimit: 3,
          paths: {
            prd: "planning/product-requirements.md",
          },
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
        },
        mcps: {
          context7: true,
          exa: true,
          grepApp: true,
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot, config);

      expect(paths.prd).toBe(`${projectRoot}/planning/product-requirements.md`);
    });

    it("should use architecture config override", async () => {
      const projectRoot = "/test/project";
      const config: AthenaConfig = {
        version: "0.8.1",
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
        models: {
          sisyphus: "test",
          oracle: "test",
          librarian: "test",
        },
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: true,
          parallelStoryLimit: 3,
          paths: {
            architecture: "design/system-architecture.md",
          },
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
        },
        mcps: {
          context7: true,
          exa: true,
          grepApp: true,
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot, config);

      expect(paths.architecture).toBe(`${projectRoot}/design/system-architecture.md`);
    });

    it("should use epics config override", async () => {
      const projectRoot = "/test/project";
      const config: AthenaConfig = {
        version: "0.8.1",
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
        models: {
          sisyphus: "test",
          oracle: "test",
          librarian: "test",
        },
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: true,
          parallelStoryLimit: 3,
          paths: {
            epics: "backlog/epic-list.md",
          },
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
        },
        mcps: {
          context7: true,
          exa: true,
          grepApp: true,
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot, config);

      expect(paths.epics).toBe(`${projectRoot}/backlog/epic-list.md`);
    });

    it("should use all path overrides simultaneously", async () => {
      const projectRoot = "/test/project";
      const config: AthenaConfig = {
        version: "0.8.1",
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
        models: {
          sisyphus: "test",
          oracle: "test",
          librarian: "test",
        },
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: true,
          parallelStoryLimit: 3,
          paths: {
            stories: "dev/stories",
            sprintStatus: "dev/status.yaml",
            prd: "planning/prd.md",
            architecture: "design/arch.md",
            epics: "planning/epics.md",
          },
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
        },
        mcps: {
          context7: true,
          exa: true,
          grepApp: true,
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot, config);

      expect(paths.storiesDir).toBe(`${projectRoot}/dev/stories`);
      expect(paths.sprintStatus).toBe(`${projectRoot}/dev/status.yaml`);
      expect(paths.prd).toBe(`${projectRoot}/planning/prd.md`);
      expect(paths.architecture).toBe(`${projectRoot}/design/arch.md`);
      expect(paths.epics).toBe(`${projectRoot}/planning/epics.md`);
    });
  });

  describe("getBmadPaths - backward compatibility", () => {
    it("should work without any config overrides (default behavior)", async () => {
      const projectRoot = "/test/project";

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/docs")) return true;
        if (pathStr.endsWith("/PRD.md")) return true;
        if (pathStr.endsWith("/architecture.md")) return true;
        if (pathStr.endsWith("/epics.md")) return true;
        if (pathStr.endsWith("/sprint-status.yaml")) return true;
        return false;
      }) as any);

      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot);

      expect(paths.prd).toContain("/PRD.md");
      expect(paths.architecture).toContain("/architecture.md");
      expect(paths.epics).toContain("/epics.md");
      expect(paths.sprintStatus).toContain("/sprint-status.yaml");
    });

    it("should handle partial config (only some paths overridden)", async () => {
      const projectRoot = "/test/project";
      const config: AthenaConfig = {
        version: "0.8.1",
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
        models: {
          sisyphus: "test",
          oracle: "test",
          librarian: "test",
        },
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: true,
          parallelStoryLimit: 3,
          paths: {
            prd: "custom/prd.md",
          },
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
        },
        mcps: {
          context7: true,
          exa: true,
          grepApp: true,
        },
      };

      mockExistsSync.mockImplementation(((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes("/docs")) return true;
        if (pathStr.endsWith("/custom/prd.md")) return true;
        if (pathStr.endsWith("/architecture.md")) return true;
        if (pathStr.endsWith("/epics.md")) return true;
        if (pathStr.endsWith("/sprint-status.yaml")) return true;
        return false;
      }) as any);

      mockReaddir.mockResolvedValue([] as any);

      const paths = await getBmadPaths(projectRoot, config);

      expect(paths.prd).toBe(`${projectRoot}/custom/prd.md`);
      expect(paths.architecture).toContain("/architecture.md");
      expect(paths.epics).toContain("/epics.md");
      expect(paths.sprintStatus).toContain("/sprint-status.yaml");
    });
  });
});
