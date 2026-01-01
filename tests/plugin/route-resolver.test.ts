import { describe, expect, it } from "vitest";
import {
  maybeSelectThinkingVariant,
  resolveModelRoute,
} from "../../src/plugin/utils/route-resolver.js";
import type { AthenaConfig } from "../../src/shared/types.js";

function createTestConfig(overrides?: Partial<AthenaConfig>): AthenaConfig {
  return {
    version: "0.11.0",
    subscriptions: {
      claude: { enabled: true, tier: "pro" },
      openai: { enabled: true },
      google: { enabled: true, authMethod: "api" },
      githubCopilot: { enabled: true, plan: "pro" },
    },
    models: {
      sisyphus: "anthropic/claude-sonnet-4",
      oracle: "anthropic/claude-opus-4",
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
    routing: {
      providerPriority: ["anthropic", "openai", "google", "github-copilot"],
      modelFamilyPriority: {
        claude: ["anthropic", "github-copilot"],
        gpt: ["openai", "github-copilot"],
        gemini: ["google", "github-copilot"],
      },
      agentOverrides: {
        oracle: { requiresThinking: true },
      },
      fallbackBehavior: {
        autoFallback: false,
        retryPeriodMs: 300000,
        notifyOnRateLimit: true,
      },
    },
    ...overrides,
  };
}

describe("route-resolver", () => {
  describe("resolveModelRoute", () => {
    it("resolves claude model using global provider priority", () => {
      const config = createTestConfig();
      const route = resolveModelRoute("claude-sonnet-4-5", "sisyphus", config);
      expect(route).toBe("anthropic/claude-sonnet-4-5");
    });

    it("resolves gpt model using global provider priority", () => {
      const config = createTestConfig();
      const route = resolveModelRoute("gpt-5.1", "librarian", config);
      expect(route).toBe("openai/gpt-5.1");
    });

    it("resolves gemini model using global provider priority", () => {
      const config = createTestConfig();
      const route = resolveModelRoute("gemini-2.5-pro", "librarian", config);
      expect(route).toBe("google/gemini-2.5-pro");
    });

    it("prefers model family priority over global provider priority", () => {
      const config = createTestConfig({
        routing: {
          providerPriority: ["google", "openai", "anthropic", "github-copilot"],
          modelFamilyPriority: {
            claude: ["anthropic", "github-copilot"],
            gpt: ["openai", "github-copilot"],
            gemini: ["google", "github-copilot"],
          },
          agentOverrides: {},
          fallbackBehavior: {
            autoFallback: false,
            retryPeriodMs: 300000,
            notifyOnRateLimit: true,
          },
        },
      });

      const route = resolveModelRoute("claude-sonnet-4-5", "sisyphus", config);
      expect(route).toBe("anthropic/claude-sonnet-4-5");
    });

    it("respects agent override preferProvider", () => {
      const config = createTestConfig({
        routing: {
          providerPriority: ["anthropic", "openai", "google", "github-copilot"],
          modelFamilyPriority: {
            claude: ["anthropic", "github-copilot"],
            gpt: ["openai", "github-copilot"],
            gemini: ["google", "github-copilot"],
          },
          agentOverrides: {
            oracle: {
              requiresThinking: true,
              preferProvider: "github-copilot",
            },
          },
          fallbackBehavior: {
            autoFallback: false,
            retryPeriodMs: 300000,
            notifyOnRateLimit: true,
          },
        },
      });

      const route = resolveModelRoute("claude-sonnet-4-5", "oracle", config);
      expect(route).toBe("github-copilot/claude-sonnet-4-5");
    });

    it("falls back to thinking-incapable provider when no thinking-capable providers available", () => {
      const config = createTestConfig({
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: true, plan: "pro" },
        },
        routing: {
          providerPriority: ["github-copilot"],
          modelFamilyPriority: {
            claude: ["github-copilot"],
            gpt: ["github-copilot"],
            gemini: ["github-copilot"],
          },
          agentOverrides: {
            oracle: { requiresThinking: true },
          },
          fallbackBehavior: {
            autoFallback: false,
            retryPeriodMs: 300000,
            notifyOnRateLimit: true,
          },
        },
      });

      const route = resolveModelRoute("claude-sonnet-4-5", "oracle", config);
      expect(route).toBe("github-copilot/claude-sonnet-4-5");
    });

    it("returns provider route even when natural provider is disabled", () => {
      const config = createTestConfig({
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: true },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
        routing: {
          providerPriority: ["openai"],
          modelFamilyPriority: {
            claude: ["anthropic"],
            gpt: ["openai"],
            gemini: ["google"],
          },
          agentOverrides: {},
          fallbackBehavior: {
            autoFallback: false,
            retryPeriodMs: 300000,
            notifyOnRateLimit: true,
          },
        },
      });

      const route = resolveModelRoute("claude-sonnet-4-5", "sisyphus", config);
      expect(route).toBe("openai/claude-sonnet-4-5");
    });

    it("falls back through priority list to natural provider when others unavailable", () => {
      const config = createTestConfig({
        subscriptions: {
          claude: { enabled: true, tier: "pro" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
        routing: {
          providerPriority: ["openai", "google", "github-copilot", "anthropic"],
          modelFamilyPriority: {
            claude: ["openai", "github-copilot", "anthropic"],
            gpt: ["openai", "github-copilot"],
            gemini: ["google", "github-copilot"],
          },
          agentOverrides: {},
          fallbackBehavior: {
            autoFallback: false,
            retryPeriodMs: 300000,
            notifyOnRateLimit: true,
          },
        },
      });

      const route = resolveModelRoute("claude-sonnet-4-5", "sisyphus", config);
      expect(route).toBe("anthropic/claude-sonnet-4-5");
    });

    it("throws error when no providers are enabled", () => {
      const config = createTestConfig({
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: false, plan: "none" },
        },
      });

      expect(() => resolveModelRoute("claude-sonnet-4-5", "sisyphus", config)).toThrow(
        "No available route"
      );
    });

    it("throws error for unknown model family", () => {
      const config = createTestConfig();

      expect(() => resolveModelRoute("llama-3-70b", "sisyphus", config)).toThrow(
        "Unknown model family type"
      );
    });
  });

  describe("maybeSelectThinkingVariant", () => {
    it("selects thinking variant for oracle when requiresThinking is true", () => {
      const config = createTestConfig();
      const variant = maybeSelectThinkingVariant("claude-sonnet-4-5", "oracle", config);
      expect(variant).toBe("claude-sonnet-4-5-thinking");
    });

    it("selects thinking variant for claude-opus models when required", () => {
      const config = createTestConfig();
      const variant = maybeSelectThinkingVariant("claude-opus-4-5", "oracle", config);
      expect(variant).toBe("claude-opus-4-5-thinking");
    });

    it("does not select thinking variant for non-claude models", () => {
      const config = createTestConfig();
      const variant = maybeSelectThinkingVariant("gpt-5.1", "oracle", config);
      expect(variant).toBe("gpt-5.1");
    });

    it("does not select thinking variant when requiresThinking is false", () => {
      const config = createTestConfig({
        routing: {
          providerPriority: ["anthropic", "openai", "google", "github-copilot"],
          modelFamilyPriority: {
            claude: ["anthropic", "github-copilot"],
            gpt: ["openai", "github-copilot"],
            gemini: ["google", "github-copilot"],
          },
          agentOverrides: {
            oracle: { requiresThinking: false },
          },
          fallbackBehavior: {
            autoFallback: false,
            retryPeriodMs: 300000,
            notifyOnRateLimit: true,
          },
        },
      });

      const variant = maybeSelectThinkingVariant("claude-sonnet-4-5", "oracle", config);
      expect(variant).toBe("claude-sonnet-4-5");
    });

    it("returns original model for agents without thinking override", () => {
      const config = createTestConfig();
      const variant = maybeSelectThinkingVariant("claude-sonnet-4-5", "sisyphus", config);
      expect(variant).toBe("claude-sonnet-4-5");
    });
  });

  describe("integration scenarios", () => {
    it("handles multi-provider fallback chain with copilot as last resort", () => {
      const config = createTestConfig({
        subscriptions: {
          claude: { enabled: false, tier: "none" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: true, plan: "pro" },
        },
        routing: {
          providerPriority: ["anthropic", "openai", "google", "github-copilot"],
          modelFamilyPriority: {
            claude: ["anthropic", "github-copilot"],
            gpt: ["openai", "github-copilot"],
            gemini: ["google", "github-copilot"],
          },
          agentOverrides: {},
          fallbackBehavior: {
            autoFallback: false,
            retryPeriodMs: 300000,
            notifyOnRateLimit: true,
          },
        },
      });

      const route = resolveModelRoute("claude-sonnet-4-5", "sisyphus", config);
      expect(route).toBe("github-copilot/claude-sonnet-4-5");
    });

    it("prefers direct provider over copilot for same model when both enabled", () => {
      const config = createTestConfig({
        subscriptions: {
          claude: { enabled: true, tier: "pro" },
          openai: { enabled: false },
          google: { enabled: false, authMethod: "none" },
          githubCopilot: { enabled: true, plan: "pro" },
        },
        routing: {
          providerPriority: ["anthropic", "github-copilot"],
          modelFamilyPriority: {
            claude: ["anthropic", "github-copilot"],
            gpt: ["openai", "github-copilot"],
            gemini: ["google", "github-copilot"],
          },
          agentOverrides: {},
          fallbackBehavior: {
            autoFallback: false,
            retryPeriodMs: 300000,
            notifyOnRateLimit: true,
          },
        },
      });

      const route = resolveModelRoute("claude-sonnet-4-5", "sisyphus", config);
      expect(route).toBe("anthropic/claude-sonnet-4-5");
    });
  });
});
