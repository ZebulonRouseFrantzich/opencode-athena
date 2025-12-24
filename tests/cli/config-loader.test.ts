import { describe, expect, it } from "vitest";
import {
  detectNewFeatures,
  extractAdvanced,
  extractFeatures,
  extractMethodology,
  extractModels,
  extractSubscriptions,
} from "../../src/cli/utils/config-loader.js";

describe("config-loader", () => {
  describe("extractSubscriptions", () => {
    it("extracts subscriptions from valid config", () => {
      const athena = {
        subscriptions: {
          claude: { enabled: true, tier: "max" },
          openai: { enabled: true },
          google: { enabled: true, authMethod: "oauth" },
          githubCopilot: { enabled: true, plan: "pro", enabledModels: ["gpt-4o"] },
        },
      };

      const result = extractSubscriptions(athena);

      expect(result).toEqual({
        hasClaude: true,
        claudeTier: "max",
        hasOpenAI: true,
        hasGoogle: true,
        googleAuth: "oauth",
        hasGitHubCopilot: true,
        copilotPlan: "pro",
        copilotEnabledModels: ["gpt-4o"],
      });
    });

    it("returns null when subscriptions is missing", () => {
      const athena = {};
      expect(extractSubscriptions(athena)).toBeNull();
    });

    it("handles partial subscriptions", () => {
      const athena = {
        subscriptions: {
          claude: { enabled: true, tier: "pro" },
        },
      };

      const result = extractSubscriptions(athena);

      expect(result?.hasClaude).toBe(true);
      expect(result?.claudeTier).toBe("pro");
      expect(result?.hasOpenAI).toBe(false);
      expect(result?.hasGoogle).toBe(false);
      expect(result?.hasGitHubCopilot).toBe(false);
    });

    it("uses default values for missing fields", () => {
      const athena = {
        subscriptions: {
          claude: { enabled: true },
        },
      };

      const result = extractSubscriptions(athena);

      expect(result?.claudeTier).toBe("none");
      expect(result?.googleAuth).toBe("none");
      expect(result?.copilotPlan).toBe("none");
      expect(result?.copilotEnabledModels).toEqual([]);
    });
  });

  describe("extractModels", () => {
    it("extracts models from valid config", () => {
      const athena = {
        models: {
          sisyphus: "anthropic/claude-sonnet-4",
          oracle: "openai/gpt-5.1",
          librarian: "anthropic/claude-haiku-4.5",
          frontend: "anthropic/claude-sonnet-4",
          documentWriter: "anthropic/claude-sonnet-4",
          multimodalLooker: "google/gemini-2.5-pro",
          explore: "anthropic/claude-haiku-4.5",
          settings: { sisyphus: { temperature: 0.3 } },
          custom: [{ id: "custom/model", name: "Custom" }],
        },
      };

      const result = extractModels(athena);

      expect(result?.sisyphus).toBe("anthropic/claude-sonnet-4");
      expect(result?.oracle).toBe("openai/gpt-5.1");
      expect(result?.librarian).toBe("anthropic/claude-haiku-4.5");
      expect(result?.frontend).toBe("anthropic/claude-sonnet-4");
      expect(result?.settings).toEqual({ sisyphus: { temperature: 0.3 } });
      expect(result?.custom).toEqual([{ id: "custom/model", name: "Custom" }]);
    });

    it("returns null when models is missing", () => {
      const athena = {};
      expect(extractModels(athena)).toBeNull();
    });

    it("uses empty string for missing required models", () => {
      const athena = {
        models: {
          sisyphus: "anthropic/claude-sonnet-4",
        },
      };

      const result = extractModels(athena);

      expect(result?.sisyphus).toBe("anthropic/claude-sonnet-4");
      expect(result?.oracle).toBe("");
      expect(result?.librarian).toBe("");
    });
  });

  describe("extractMethodology", () => {
    it("extracts methodology from valid config", () => {
      const athena = {
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: true,
        },
      };

      const result = extractMethodology(athena);

      expect(result?.defaultTrack).toBe("bmad-method");
      expect(result?.autoStatusUpdate).toBe(true);
    });

    it("returns null when bmad is missing", () => {
      const athena = {};
      expect(extractMethodology(athena)).toBeNull();
    });

    it("defaults autoStatusUpdate to true", () => {
      const athena = {
        bmad: {
          defaultTrack: "bmad-method",
        },
      };

      const result = extractMethodology(athena);

      expect(result?.autoStatusUpdate).toBe(true);
    });

    it("respects explicit false for autoStatusUpdate", () => {
      const athena = {
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: false,
        },
      };

      const result = extractMethodology(athena);

      expect(result?.autoStatusUpdate).toBe(false);
    });
  });

  describe("extractFeatures", () => {
    it("extracts features from valid config", () => {
      const athena = {
        features: {
          autoStatus: true,
          parallelExecution: true,
          notifications: false,
          contextMonitor: true,
          commentChecker: false,
          lspTools: true,
        },
        mcps: {
          context7: true,
          exa: false,
          grepApp: true,
        },
      };

      const result = extractFeatures(athena);

      expect(result?.enabledFeatures).toContain("auto-status");
      expect(result?.enabledFeatures).toContain("parallel");
      expect(result?.enabledFeatures).not.toContain("notifications");
      expect(result?.enabledFeatures).toContain("context-monitor");
      expect(result?.enabledFeatures).not.toContain("comment-checker");
      expect(result?.enabledFeatures).toContain("lsp-tools");
      expect(result?.mcps).toContain("context7");
      expect(result?.mcps).not.toContain("exa");
      expect(result?.mcps).toContain("grep_app");
    });

    it("returns null when features is missing", () => {
      const athena = {};
      expect(extractFeatures(athena)).toBeNull();
    });

    it("handles empty features", () => {
      const athena = {
        features: {},
      };

      const result = extractFeatures(athena);

      expect(result?.enabledFeatures).toEqual([]);
      expect(result?.mcps).toEqual([]);
    });
  });

  describe("extractAdvanced", () => {
    it("extracts advanced settings from valid config", () => {
      const athena = {
        bmad: {
          parallelStoryLimit: 5,
        },
      };

      const result = extractAdvanced(athena);

      expect(result?.parallelStoryLimit).toBe(5);
      expect(result?.experimental).toEqual([]);
    });

    it("returns defaults when bmad is missing", () => {
      const athena = {};

      const result = extractAdvanced(athena);

      expect(result?.parallelStoryLimit).toBe(3);
      expect(result?.experimental).toEqual([]);
    });

    it("uses default parallelStoryLimit of 3", () => {
      const athena = {
        bmad: {},
      };

      const result = extractAdvanced(athena);

      expect(result?.parallelStoryLimit).toBe(3);
    });
  });

  describe("detectNewFeatures", () => {
    it("detects autoGitOperations as new when undefined", () => {
      const athena = {
        features: {},
      };

      const result = detectNewFeatures(athena);

      expect(result).toContain("autoGitOperations");
    });

    it("does not detect autoGitOperations when already set to false", () => {
      const athena = {
        features: {
          autoGitOperations: false,
        },
      };

      const result = detectNewFeatures(athena);

      expect(result).not.toContain("autoGitOperations");
    });

    it("does not detect autoGitOperations when already set to true", () => {
      const athena = {
        features: {
          autoGitOperations: true,
        },
      };

      const result = detectNewFeatures(athena);

      expect(result).not.toContain("autoGitOperations");
    });

    it("returns empty array when no features object", () => {
      const athena = {};

      const result = detectNewFeatures(athena);

      expect(result).toContain("autoGitOperations");
    });
  });
});
