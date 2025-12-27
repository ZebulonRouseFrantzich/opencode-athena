import { describe, it, expect, beforeEach } from "vitest";
import { createToolHooks } from "../../src/plugin/hooks/tool-hooks.js";
import type { AthenaConfig } from "../../src/shared/types.js";
import type { StoryTracker } from "../../src/plugin/tracker/story-tracker.js";
import type { PluginInput } from "@opencode-ai/plugin";

describe("tool-hooks", () => {
  let mockCtx: PluginInput;
  let mockTracker: StoryTracker;
  let config: AthenaConfig;

  beforeEach(() => {
    mockCtx = { directory: "/test" } as PluginInput;
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
        todoSync: false,
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
      const hooks = createToolHooks(mockCtx, mockTracker, config);
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
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "Push successful",
        metadata: { command: "git push origin main" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for gh pr create", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
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
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "Changes committed",
        metadata: { command: "git commit -m 'test'" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should NOT inject warning for read-only git commands", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "git status output",
        metadata: { command: "git status" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should NOT inject warning for non-bash tools", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "read",
        output: "file contents",
        metadata: {},
      };

      await hooks.after({ tool: "read", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle missing command metadata", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "output",
        metadata: {},
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should NOT inject warning for echo with git command in string", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "echoed text",
        metadata: { command: "echo 'git commit example'" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should NOT inject warning for grep with git command pattern", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "grep results",
        metadata: { command: "grep 'git push' logfile.txt" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for command chaining with &&", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "tests passed, committed",
        metadata: { command: "npm test && git commit -m 'passing tests'" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for command chaining with semicolon", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "changed dir and pushed",
        metadata: { command: "cd repo; git push origin main" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for command chaining with pipe", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "piped output",
        metadata: { command: "echo 'test' | git commit -F -" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle different casing (Git Commit)", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "committed",
        metadata: { command: "Git Commit -m 'test'" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle uppercase (GIT PUSH)", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "pushed",
        metadata: { command: "GIT PUSH origin main" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle leading whitespace", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "committed",
        metadata: { command: "   git commit -m 'test'" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle trailing whitespace", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "pushed",
        metadata: { command: "git push   " },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle newlines in command", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "committed",
        metadata: { command: "\ngit commit -m 'test'\n" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle null metadata", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "output",
        metadata: null,
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle undefined metadata", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "output",
        metadata: undefined,
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle non-object metadata", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "output",
        metadata: "not an object",
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should handle non-string command in metadata", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "output",
        metadata: { command: 123 },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).not.toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for git switch -c", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "switched to new branch",
        metadata: { command: "git switch -c feature-branch" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for git tag", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "tag created",
        metadata: { command: "git tag v1.0.0" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for git reset", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "reset complete",
        metadata: { command: "git reset --hard HEAD~1" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for gh issue edit", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "issue updated",
        metadata: { command: "gh issue edit 123 --title 'New title'" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });

    it("should inject warning for gh release delete", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = {
        title: "bash",
        output: "release deleted",
        metadata: { command: "gh release delete v1.0.0" },
      };

      await hooks.after({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.output).toContain("⚠️ ATHENA GIT OPERATIONS POLICY REMINDER");
    });
  });

  describe("before hook", () => {
    it("should not modify args", async () => {
      const hooks = createToolHooks(mockCtx, mockTracker, config);
      const output = { args: { test: "value" } };

      await hooks.before({ tool: "bash", sessionID: "test", callID: "1" }, output);

      expect(output.args).toEqual({ test: "value" });
    });
  });
});
