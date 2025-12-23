import { describe, expect, it } from "vitest";
import {
  getEffectiveTemperature,
  getEffectiveThinkingLevel,
  getProviderParams,
  modelSupportsTemperature,
  modelSupportsThinking,
} from "../../src/plugin/utils/model-params.js";
import type { AthenaConfig } from "../../src/shared/types.js";

const BASE_CONFIG: AthenaConfig = {
  version: "0.0.1",
  subscriptions: {
    claude: { enabled: true, tier: "max5x" },
    openai: { enabled: true },
    google: { enabled: true, authMethod: "antigravity" },
    githubCopilot: { enabled: false, plan: "none" },
  },
  models: {
    sisyphus: "anthropic/claude-sonnet-4-5-thinking",
    oracle: "openai/gpt-5.1-high",
    librarian: "anthropic/claude-sonnet-4-5",
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

describe("model-params", () => {
  describe("getEffectiveTemperature", () => {
    it("returns undefined for models that do not support temperature", () => {
      const temp = getEffectiveTemperature("openai/gpt-5.1", "sisyphus", BASE_CONFIG);
      expect(temp).toBeUndefined();
    });

    it("calculates temperature based on model family and role", () => {
      const temp = getEffectiveTemperature("anthropic/claude-sonnet-4-5", "sisyphus", BASE_CONFIG);
      expect(temp).toBeDefined();
      expect(temp).toBeGreaterThanOrEqual(0);
      expect(temp).toBeLessThanOrEqual(1);
    });

    it("applies role-based adjustments", () => {
      const oracleTemp = getEffectiveTemperature("anthropic/claude-sonnet-4-5", "oracle", BASE_CONFIG);
      const frontendTemp = getEffectiveTemperature("anthropic/claude-sonnet-4-5", "frontend", BASE_CONFIG);
      
      expect(oracleTemp).toBeDefined();
      expect(frontendTemp).toBeDefined();
      expect(frontendTemp!).toBeGreaterThan(oracleTemp!);
    });

    it("respects user role overrides", () => {
      const config: AthenaConfig = {
        ...BASE_CONFIG,
        models: {
          ...BASE_CONFIG.models,
          settings: {
            sisyphus: { temperature: 0.7 },
          },
        },
      };
      const temp = getEffectiveTemperature("anthropic/claude-sonnet-4-5", "sisyphus", config);
      expect(temp).toBe(0.7);
    });

    it("respects model-specific overrides", () => {
      const config: AthenaConfig = {
        ...BASE_CONFIG,
        models: {
          ...BASE_CONFIG.models,
          settings: {
            overrides: {
              "anthropic/claude-sonnet-4-5": { temperature: 0.9 },
            },
          },
        },
      };
      const temp = getEffectiveTemperature("anthropic/claude-sonnet-4-5", "sisyphus", config);
      expect(temp).toBe(0.9);
    });

    it("returns undefined for Copilot models", () => {
      const temp = getEffectiveTemperature("github-copilot/claude-sonnet-4.5", "sisyphus", BASE_CONFIG);
      expect(temp).toBeUndefined();
    });
  });

  describe("getEffectiveThinkingLevel", () => {
    it("returns undefined for models that do not support thinking", () => {
      const level = getEffectiveThinkingLevel("anthropic/claude-sonnet-4-5", "oracle", BASE_CONFIG);
      expect(level).toBeUndefined();
    });

    it("returns default thinking level for thinking-capable models", () => {
      const level = getEffectiveThinkingLevel("anthropic/claude-sonnet-4-5-thinking", "oracle", BASE_CONFIG);
      expect(level).toBe("high");
    });

    it("applies role-based defaults", () => {
      const oracleLevel = getEffectiveThinkingLevel("anthropic/claude-sonnet-4-5-thinking", "oracle", BASE_CONFIG);
      const librarianLevel = getEffectiveThinkingLevel("anthropic/claude-sonnet-4-5-thinking", "librarian", BASE_CONFIG);
      
      expect(oracleLevel).toBe("high");
      expect(librarianLevel).toBe("low");
    });

    it("respects user role overrides", () => {
      const config: AthenaConfig = {
        ...BASE_CONFIG,
        models: {
          ...BASE_CONFIG.models,
          settings: {
            sisyphus: { thinkingLevel: "high" },
          },
        },
      };
      const level = getEffectiveThinkingLevel("anthropic/claude-sonnet-4-5-thinking", "sisyphus", config);
      expect(level).toBe("high");
    });
  });

  describe("getProviderParams", () => {
    it("returns temperature for Claude models", () => {
      const params = getProviderParams("anthropic/claude-sonnet-4-5", "sisyphus", BASE_CONFIG);
      expect(params.temperature).toBeDefined();
    });

    it("returns thinking_budget for Claude thinking models", () => {
      const params = getProviderParams("anthropic/claude-sonnet-4-5-thinking", "oracle", BASE_CONFIG);
      expect(params.thinking_budget).toBeDefined();
      expect(params.thinking_budget).toBeGreaterThan(0);
    });

    it("returns reasoning_effort for OpenAI high models", () => {
      const params = getProviderParams("openai/gpt-5.1-high", "oracle", BASE_CONFIG);
      expect(params.reasoning_effort).toBe("high");
    });

    it("returns thinking_level for Gemini models with thinking", () => {
      const params = getProviderParams("google/gemini-2.5-pro", "oracle", BASE_CONFIG);
      expect(params.thinking_level).toBeDefined();
    });

    it("returns empty params for Copilot models", () => {
      const params = getProviderParams("github-copilot/claude-sonnet-4.5", "sisyphus", BASE_CONFIG);
      expect(params.temperature).toBeUndefined();
      expect(params.thinking_budget).toBeUndefined();
      expect(params.reasoning_effort).toBeUndefined();
    });
  });

  describe("capability detection", () => {
    it("detects temperature support correctly", () => {
      expect(modelSupportsTemperature("anthropic/claude-sonnet-4-5")).toBe(true);
      expect(modelSupportsTemperature("openai/gpt-5.1")).toBe(false);
      expect(modelSupportsTemperature("openai/gpt-4o")).toBe(true);
      expect(modelSupportsTemperature("github-copilot/claude-sonnet-4.5")).toBe(false);
    });

    it("detects thinking support correctly", () => {
      expect(modelSupportsThinking("anthropic/claude-sonnet-4-5-thinking")).toBe(true);
      expect(modelSupportsThinking("anthropic/claude-sonnet-4-5")).toBe(false);
      expect(modelSupportsThinking("openai/gpt-5.1-high")).toBe(true);
      expect(modelSupportsThinking("github-copilot/claude-sonnet-4.5")).toBe(false);
    });
  });
});
