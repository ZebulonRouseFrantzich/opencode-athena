import { describe, expect, it } from "vitest";
import { getAvailableModels } from "../../src/cli/questions/models.js";
import type { SubscriptionAnswers } from "../../src/shared/types.js";

const BASE_SUBS: SubscriptionAnswers = {
  hasClaude: false,
  claudeTier: "none",
  hasOpenAI: false,
  hasGoogle: false,
  googleAuth: "none",
  hasGitHubCopilot: false,
  copilotPlan: "none",
};

describe("Copilot model filtering", () => {
  describe("getAvailableModels", () => {
    it("returns no Copilot models when Copilot is disabled", () => {
      const subs: SubscriptionAnswers = { ...BASE_SUBS };
      const models = getAvailableModels(subs);
      const copilotModels = models.filter((m) => m.provider === "github-copilot");
      expect(copilotModels).toHaveLength(0);
    });

    it("returns only free tier models for Copilot Free plan", () => {
      const subs: SubscriptionAnswers = {
        ...BASE_SUBS,
        hasGitHubCopilot: true,
        copilotPlan: "free",
      };
      const models = getAvailableModels(subs);
      const copilotModels = models.filter((m) => m.provider === "github-copilot");

      expect(copilotModels.length).toBeGreaterThan(0);
      expect(copilotModels.every((m) => 
        m.id.includes("gpt-4.1") || 
        m.id.includes("gpt-5-mini") || 
        m.id.includes("haiku")
      )).toBe(true);
      expect(copilotModels.some((m) => m.id.includes("sonnet"))).toBe(false);
      expect(copilotModels.some((m) => m.id.includes("opus"))).toBe(false);
    });

    it("returns Pro tier models for Copilot Pro plan", () => {
      const subs: SubscriptionAnswers = {
        ...BASE_SUBS,
        hasGitHubCopilot: true,
        copilotPlan: "pro",
      };
      const models = getAvailableModels(subs);
      const copilotModels = models.filter((m) => m.provider === "github-copilot");

      expect(copilotModels.some((m) => m.id.includes("sonnet"))).toBe(true);
      expect(copilotModels.some((m) => m.id.includes("gpt-5.1"))).toBe(true);
      expect(copilotModels.some((m) => m.id.includes("opus"))).toBe(false);
    });

    it("returns Pro tier models for Copilot Business plan (no Opus)", () => {
      const subs: SubscriptionAnswers = {
        ...BASE_SUBS,
        hasGitHubCopilot: true,
        copilotPlan: "business",
      };
      const models = getAvailableModels(subs);
      const copilotModels = models.filter((m) => m.provider === "github-copilot");

      expect(copilotModels.some((m) => m.id.includes("sonnet"))).toBe(true);
      expect(copilotModels.some((m) => m.id.includes("opus"))).toBe(false);
    });

    it("includes Opus models for Pro+ plan", () => {
      const subs: SubscriptionAnswers = {
        ...BASE_SUBS,
        hasGitHubCopilot: true,
        copilotPlan: "pro-plus",
      };
      const models = getAvailableModels(subs);
      const copilotModels = models.filter((m) => m.provider === "github-copilot");

      expect(copilotModels.some((m) => m.id.includes("opus"))).toBe(true);
    });

    it("includes Opus models for Enterprise plan", () => {
      const subs: SubscriptionAnswers = {
        ...BASE_SUBS,
        hasGitHubCopilot: true,
        copilotPlan: "enterprise",
      };
      const models = getAvailableModels(subs);
      const copilotModels = models.filter((m) => m.provider === "github-copilot");

      expect(copilotModels.some((m) => m.id.includes("opus"))).toBe(true);
      expect(copilotModels.some((m) => m.id.includes("sonnet"))).toBe(true);
      expect(copilotModels.some((m) => m.id.includes("gemini"))).toBe(true);
    });

    it("filters by copilotEnabledModels when provided", () => {
      const subs: SubscriptionAnswers = {
        ...BASE_SUBS,
        hasGitHubCopilot: true,
        copilotPlan: "business",
        copilotEnabledModels: ["github-copilot/claude-sonnet-4.5"],
      };
      const models = getAvailableModels(subs);
      const copilotModels = models.filter((m) => m.provider === "github-copilot");

      expect(copilotModels).toHaveLength(1);
      expect(copilotModels[0].id).toBe("github-copilot/claude-sonnet-4.5");
    });

    it("returns both direct and Copilot models when both are enabled", () => {
      const subs: SubscriptionAnswers = {
        ...BASE_SUBS,
        hasClaude: true,
        claudeTier: "max5x",
        hasGitHubCopilot: true,
        copilotPlan: "business",
      };
      const models = getAvailableModels(subs);

      const directClaude = models.filter((m) => m.provider === "anthropic");
      const copilotModels = models.filter((m) => m.provider === "github-copilot");

      expect(directClaude.length).toBeGreaterThan(0);
      expect(copilotModels.length).toBeGreaterThan(0);
    });
  });
});
