import { describe, expect, it } from "vitest";
import { generateOmoConfig } from "../../src/cli/generators/omo-config.js";
import type { InstallAnswers } from "../../src/shared/types.js";

const createBaseAnswers = (): InstallAnswers => ({
  subscriptions: {
    hasClaude: true,
    claudeTier: "pro",
    hasOpenAI: false,
    hasGoogle: false,
    googleAuth: "none",
    hasGitHubCopilot: false,
    copilotPlan: "none",
  },
  models: {
    sisyphus: "anthropic/claude-sonnet-4-5-thinking",
    oracle: "openai/gpt-5.1-high",
    librarian: "google/gemini-2.5-flash",
  },
  methodology: {
    defaultTrack: "bmad-method",
    autoStatusUpdate: true,
  },
  features: {
    enabledFeatures: ["auto-status", "notifications", "context-monitor", "lsp-tools"],
    mcps: ["context7", "exa", "grep_app"],
  },
  advanced: {
    parallelStoryLimit: 3,
    experimental: [],
  },
  installLocation: "global",
});

describe("generateOmoConfig", () => {
  describe("agent mappings", () => {
    it("should include all required agents", () => {
      const answers = createBaseAnswers();
      const config = generateOmoConfig(answers);

      expect(config.agents).toBeDefined();
      const agents = config.agents as Record<string, unknown>;

      expect(agents.Sisyphus).toBeDefined();
      expect(agents.oracle).toBeDefined();
      expect(agents.librarian).toBeDefined();
      expect(agents["frontend-ui-ux-engineer"]).toBeDefined();
      expect(agents["document-writer"]).toBeDefined();
      expect(agents["multimodal-looker"]).toBeDefined();
    });

    it("should include explore agent", () => {
      const answers = createBaseAnswers();
      const config = generateOmoConfig(answers);

      const agents = config.agents as Record<string, unknown>;
      expect(agents.explore).toBeDefined();
      expect((agents.explore as Record<string, unknown>).model).toBe(answers.models.librarian);
    });

    it("should include general fallback agent", () => {
      const answers = createBaseAnswers();
      const config = generateOmoConfig(answers);

      const agents = config.agents as Record<string, unknown>;
      expect(agents.general).toBeDefined();
      expect((agents.general as Record<string, unknown>).model).toBe(answers.models.oracle);
    });

    it("should use librarian model for explore by default", () => {
      const answers = createBaseAnswers();
      answers.models.librarian = "google/gemini-2.5-flash";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const explore = agents.explore as Record<string, unknown>;

      expect(explore.model).toBe("google/gemini-2.5-flash");
    });

    it("should use specified explore model when provided", () => {
      const answers = createBaseAnswers();
      answers.models.explore = "anthropic/claude-haiku-4-5";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const explore = agents.explore as Record<string, unknown>;

      expect(explore.model).toBe("anthropic/claude-haiku-4-5");
    });

    it("should fallback to sisyphus for frontend if not specified", () => {
      const answers = createBaseAnswers();
      delete answers.models.frontend;

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const frontend = agents["frontend-ui-ux-engineer"] as Record<string, unknown>;

      expect(frontend.model).toBe(answers.models.sisyphus);
    });
  });

  describe("temperature parameters", () => {
    it("should include temperature for thinking models", () => {
      const answers = createBaseAnswers();
      answers.models.sisyphus = "anthropic/claude-sonnet-4-5-thinking";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const sisyphus = agents.Sisyphus as Record<string, unknown>;

      expect(sisyphus.temperature).toBeDefined();
      expect(typeof sisyphus.temperature).toBe("number");
    });

    it("should include temperature for non-thinking Claude models", () => {
      const answers = createBaseAnswers();
      answers.models.librarian = "anthropic/claude-sonnet-4-5";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const librarian = agents.librarian as Record<string, unknown>;

      expect(librarian.temperature).toBeDefined();
      expect(typeof librarian.temperature).toBe("number");
    });

    it("should apply role-specific temperature adjustments", () => {
      const answers = createBaseAnswers();
      answers.models.oracle = "anthropic/claude-opus-4-5";
      answers.models.librarian = "anthropic/claude-sonnet-4-5";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const oracle = agents.oracle as Record<string, unknown>;
      const librarian = agents.librarian as Record<string, unknown>;

      expect(oracle.temperature).toBeDefined();
      expect(librarian.temperature).toBeDefined();
      expect((oracle.temperature as number) < (librarian.temperature as number)).toBe(true);
    });

    it("should set precise temperature for explore agent", () => {
      const answers = createBaseAnswers();
      answers.models.librarian = "anthropic/claude-sonnet-4-5";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const librarian = agents.librarian as Record<string, unknown>;
      const explore = agents.explore as Record<string, unknown>;

      expect(explore.temperature).toBeDefined();
      expect((explore.temperature as number) < (librarian.temperature as number)).toBe(true);
    });
  });

  describe("thinking parameters", () => {
    it("should include thinking_budget for Anthropic thinking models", () => {
      const answers = createBaseAnswers();
      answers.models.sisyphus = "anthropic/claude-sonnet-4-5-thinking";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const sisyphus = agents.Sisyphus as Record<string, unknown>;

      expect(sisyphus.thinking_budget).toBeDefined();
      expect(typeof sisyphus.thinking_budget).toBe("number");
      expect(sisyphus.thinking_budget).toBeGreaterThan(0);
    });

    it("should include reasoning_effort for OpenAI reasoning models", () => {
      const answers = createBaseAnswers();
      answers.models.oracle = "openai/gpt-5.1-high";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const oracle = agents.oracle as Record<string, unknown>;

      expect(oracle.reasoning_effort).toBeDefined();
      expect(["low", "medium", "high"]).toContain(oracle.reasoning_effort);
    });

    it("should not include thinking params for non-thinking models", () => {
      const answers = createBaseAnswers();
      answers.models.librarian = "google/gemini-2.5-flash";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const librarian = agents.librarian as Record<string, unknown>;

      expect(librarian.thinking_budget).toBeUndefined();
      expect(librarian.reasoning_effort).toBeUndefined();
      expect(librarian.thinking_level).toBeUndefined();
    });

    it("should not include thinking params for explore agent", () => {
      const answers = createBaseAnswers();
      answers.models.librarian = "google/gemini-2.5-flash";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const explore = agents.explore as Record<string, unknown>;

      expect(explore.thinking_budget).toBeUndefined();
      expect(explore.reasoning_effort).toBeUndefined();
      expect(explore.thinking_level).toBeUndefined();
    });

    it("should use higher thinking level for oracle than sisyphus", () => {
      const answers = createBaseAnswers();
      answers.models.sisyphus = "anthropic/claude-sonnet-4-5-thinking";
      answers.models.oracle = "anthropic/claude-opus-4-5-thinking";

      const config = generateOmoConfig(answers);
      const agents = config.agents as Record<string, unknown>;
      const sisyphus = agents.Sisyphus as Record<string, unknown>;
      const oracle = agents.oracle as Record<string, unknown>;

      expect(oracle.thinking_budget).toBeDefined();
      expect(sisyphus.thinking_budget).toBeDefined();
      expect((oracle.thinking_budget as number) > (sisyphus.thinking_budget as number)).toBe(true);
    });
  });

  describe("Google auth configuration", () => {
    it("should disable google_auth when using antigravity", () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "antigravity";

      const config = generateOmoConfig(answers);
      expect(config.google_auth).toBe(false);
    });

    it("should not set google_auth when not using antigravity", () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "personal";

      const config = generateOmoConfig(answers);
      expect(config.google_auth).toBeUndefined();
    });
  });

  describe("disabled hooks", () => {
    it("should disable context monitor when feature is disabled", () => {
      const answers = createBaseAnswers();
      answers.features.enabledFeatures = ["auto-status"];

      const config = generateOmoConfig(answers);
      const hooks = config.disabled_hooks as string[];

      expect(hooks).toContain("context-window-monitor");
    });

    it("should disable notifications hooks when notifications disabled", () => {
      const answers = createBaseAnswers();
      answers.features.enabledFeatures = ["auto-status"];

      const config = generateOmoConfig(answers);
      const hooks = config.disabled_hooks as string[];

      expect(hooks).toContain("session-notification");
      expect(hooks).toContain("background-notification");
    });

    it("should not include disabled_hooks when all features enabled", () => {
      const answers = createBaseAnswers();
      answers.features.enabledFeatures = ["context-monitor", "comment-checker", "notifications"];

      const config = generateOmoConfig(answers);
      expect(config.disabled_hooks).toBeUndefined();
    });
  });

  describe("disabled MCPs", () => {
    it("should disable MCPs not in the enabled list", () => {
      const answers = createBaseAnswers();
      answers.features.mcps = ["context7"];

      const config = generateOmoConfig(answers);
      const mcps = config.disabled_mcps as string[];

      expect(mcps).toContain("websearch_exa");
      expect(mcps).toContain("grep_app");
      expect(mcps).not.toContain("context7");
    });

    it("should map exa to websearch_exa", () => {
      const answers = createBaseAnswers();
      answers.features.mcps = ["exa"];

      const config = generateOmoConfig(answers);
      const mcps = config.disabled_mcps as string[];

      expect(mcps).not.toContain("websearch_exa");
      expect(mcps).toContain("context7");
    });

    it("should not include disabled_mcps when all MCPs enabled", () => {
      const answers = createBaseAnswers();
      answers.features.mcps = ["context7", "exa", "grep_app"];

      const config = generateOmoConfig(answers);
      expect(config.disabled_mcps).toBeUndefined();
    });
  });

  describe("experimental features", () => {
    it("should include aggressive_truncation when enabled", () => {
      const answers = createBaseAnswers();
      answers.advanced.experimental = ["aggressive-truncation"];

      const config = generateOmoConfig(answers);
      const experimental = config.experimental as Record<string, unknown>;

      expect(experimental.aggressive_truncation).toBe(true);
    });

    it("should include auto_resume when enabled", () => {
      const answers = createBaseAnswers();
      answers.advanced.experimental = ["auto-resume"];

      const config = generateOmoConfig(answers);
      const experimental = config.experimental as Record<string, unknown>;

      expect(experimental.auto_resume).toBe(true);
    });

    it("should not include experimental when none selected", () => {
      const answers = createBaseAnswers();
      answers.advanced.experimental = [];

      const config = generateOmoConfig(answers);
      expect(config.experimental).toBeUndefined();
    });
  });
});
