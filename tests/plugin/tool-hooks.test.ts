import { describe, it, expect, beforeEach } from "vitest";
import { createToolHooks } from "../../src/plugin/hooks/tool-hooks.js";
import type { AthenaConfig } from "../../src/shared/types.js";
import type { StoryTracker } from "../../src/plugin/tracker/story-tracker.js";

describe("tool-hooks", () => {
  let mockTracker: StoryTracker;
  let config: AthenaConfig;

  beforeEach(() => {
    mockTracker = {} as StoryTracker;
    config = {
      version: "1.0.0",
      subscriptions: {
        claude: { enabled: false, tier: "none" },
        openai: { enabled: false },
        google: { enabled: false, authMethod: "none" },
        githubCopilot: { enabled: false, plan: "none" },
      },
      models: {
        sisyphus: "anthropic/claude-sonnet-4",
        oracle: "openai/gpt-5.2",
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
      },
      mcps: {
        context7: true,
        exa: true,
        grepApp: true,
      },
    };
  });

  describe("after hook - git operations warning", () => {
    it("should inject warning when autoGitOperations is false and git commit is detected", async () => {
      const hooks = createToolHooks(mockTracker, config);
      const output = {
        title: "bash",
        output: "Changes committed successfully",
        metadata: { command: "git commit -m 'test commit'" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
      expect(output.output).toContain("explicitly requested by the user");
    });

    it("should inject warning for git push", async () => {
      const hooks = createToolHooks(mockTracker, config);
      const output = {
        title: "bash",
        output: "Push successful",
        metadata: { command: "git push origin main" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for gh pr create", async () => {
      const hooks = createToolHooks(mockTracker, config);
      const output = {
        title: "bash",
        output: "PR created",
        metadata: { command: "gh pr create --title 'Test PR'" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should NOT inject warning when autoGitOperations is true", async () => {
      config.features.autoGitOperations = true;
      const hooks = createToolHooks(mockTracker, config);
      const output = {
        title: "bash",
        output: "Changes committed",
        metadata: { command: "git commit -m 'test'" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should NOT inject warning for read-only git commands", async () => {
      const hooks = createToolHooks(mockTracker, config);
      const output = {
        title: "bash",
        output: "git status output",
        metadata: { command: "git status" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should NOT inject warning for non-bash tools", async () => {
      const hooks = createToolHooks(mockTracker, config);
      const output = {
        title: "read",
        output: "file contents",
        metadata: {},
      };

      await hooks.after({ tool: "read", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle missing command metadata", async () => {
      const hooks = createToolHooks(mockTracker, config);
      const output = {
        title: "bash",
        output: "output",
        metadata: {},
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });
  });

  describe("before hook", () => {
    it("should not modify args", async () => {
      const hooks = createToolHooks(mockTracker, config);
      const output = { args: { test: "value" } };

      await hooks.before({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.args).toEqual({ test: "value" });
    });
  });
});
