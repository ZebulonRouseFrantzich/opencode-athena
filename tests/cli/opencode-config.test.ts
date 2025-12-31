import { describe, expect, it } from "vitest";
import { generateOpencodeConfig } from "../../src/cli/generators/opencode-config.js";
import type { InstallAnswers } from "../../src/shared/types.js";

const createBaseAnswers = (): InstallAnswers => ({
  subscriptions: {
    hasClaude: false,
    claudeTier: "none",
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
    enabledFeatures: [],
    mcps: [],
  },
  advanced: {
    parallelStoryLimit: 3,
    experimental: [],
  },
  installLocation: "global",
});

describe("generateOpencodeConfig", () => {
  describe("plugin configuration", () => {
    it("should include base plugins", async () => {
      const answers = createBaseAnswers();
      const config = await generateOpencodeConfig(answers, "/test/config");

      expect(config.plugin).toBeDefined();
      expect(Array.isArray(config.plugin)).toBe(true);
      expect(config.plugin).toContain("opencode-athena/plugin");
      expect(config.plugin).toContain("oh-my-opencode");
    });

    it("should add opencode-antigravity-auth when Google Antigravity selected", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "antigravity";

      const config = await generateOpencodeConfig(answers, "/test/config");

      expect(config.plugin).toContain("opencode-antigravity-auth");
    });

    it("should not add opencode-antigravity-auth for Google personal auth", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "personal";

      const config = await generateOpencodeConfig(answers, "/test/config");

      expect(config.plugin).not.toContain("opencode-antigravity-auth");
    });

    it("should not add opencode-antigravity-auth for Google API auth", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "api";

      const config = await generateOpencodeConfig(answers, "/test/config");

      expect(config.plugin).not.toContain("opencode-antigravity-auth");
    });
  });

  describe("Google Antigravity provider models", () => {
    it("should add provider.google.models when Google Antigravity selected", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "antigravity";

      const config = await generateOpencodeConfig(answers, "/test/config");

      expect(config.provider).toBeDefined();
      const provider = config.provider as Record<string, unknown>;
      expect(provider.google).toBeDefined();

      const google = provider.google as Record<string, unknown>;
      expect(google.models).toBeDefined();

      const models = google.models as Record<string, unknown>;

      expect(models["gemini-3-pro-high"]).toBeDefined();
      expect(models["gemini-3-pro-low"]).toBeDefined();
      expect(models["gemini-3-flash"]).toBeDefined();
      expect(models["claude-sonnet-4-5"]).toBeDefined();
      expect(models["claude-sonnet-4-5-thinking"]).toBeDefined();
      expect(models["claude-opus-4-5-thinking"]).toBeDefined();
      expect(models["gpt-oss-120b-medium"]).toBeDefined();
    });

    it("should not add provider.google.models for Google personal auth", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "personal";

      const config = await generateOpencodeConfig(answers, "/test/config");

      if (config.provider) {
        const provider = config.provider as Record<string, unknown>;
        expect(provider.google).toBeUndefined();
      }
    });

    it("should not add provider.google.models for Google API auth", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "api";

      const config = await generateOpencodeConfig(answers, "/test/config");

      if (config.provider) {
        const provider = config.provider as Record<string, unknown>;
        expect(provider.google).toBeUndefined();
      }
    });

    it("should not add provider.google.models when Google not selected", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = false;

      const config = await generateOpencodeConfig(answers, "/test/config");

      if (config.provider) {
        const provider = config.provider as Record<string, unknown>;
        expect(provider.google).toBeUndefined();
      }
    });

    it("should include correct model metadata for Gemini models", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "antigravity";

      const config = await generateOpencodeConfig(answers, "/test/config");

      const provider = config.provider as Record<string, unknown>;
      const google = provider.google as Record<string, unknown>;
      const models = google.models as Record<string, unknown>;
      const geminiProHigh = models["gemini-3-pro-high"] as Record<string, unknown>;

      expect(geminiProHigh.name).toBe("Gemini 3 Pro High (Antigravity)");
      expect(geminiProHigh.limit).toEqual({
        context: 1048576,
        output: 65535,
      });
      expect(geminiProHigh.modalities).toEqual({
        input: ["text", "image", "pdf"],
        output: ["text"],
      });
    });

    it("should include correct model metadata for Claude models via Antigravity", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "antigravity";

      const config = await generateOpencodeConfig(answers, "/test/config");

      const provider = config.provider as Record<string, unknown>;
      const google = provider.google as Record<string, unknown>;
      const models = google.models as Record<string, unknown>;
      const claudeSonnet = models["claude-sonnet-4-5"] as Record<string, unknown>;

      expect(claudeSonnet.name).toBe("Claude Sonnet 4.5 (Antigravity)");
      expect(claudeSonnet.limit).toEqual({
        context: 200000,
        output: 64000,
      });
      expect(claudeSonnet.modalities).toEqual({
        input: ["text", "image", "pdf"],
        output: ["text"],
      });
    });

    it("should include correct model metadata for GPT models via Antigravity", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasGoogle = true;
      answers.subscriptions.googleAuth = "antigravity";

      const config = await generateOpencodeConfig(answers, "/test/config");

      const provider = config.provider as Record<string, unknown>;
      const google = provider.google as Record<string, unknown>;
      const models = google.models as Record<string, unknown>;
      const gptOss = models["gpt-oss-120b-medium"] as Record<string, unknown>;

      expect(gptOss.name).toBe("GPT-OSS 120B Medium (Antigravity)");
      expect(gptOss.limit).toEqual({
        context: 131072,
        output: 32768,
      });
      expect(gptOss.modalities).toEqual({
        input: ["text", "image", "pdf"],
        output: ["text"],
      });
    });
  });

  describe("Claude provider models", () => {
    it("should add provider.anthropic.models when Claude selected", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasClaude = true;

      const config = await generateOpencodeConfig(answers, "/test/config");

      expect(config.provider).toBeDefined();
      const provider = config.provider as Record<string, unknown>;
      expect(provider.anthropic).toBeDefined();

      const anthropic = provider.anthropic as Record<string, unknown>;
      expect(anthropic.models).toBeDefined();

      const models = anthropic.models as Record<string, unknown>;
      expect(models["claude-opus-4-5-thinking"]).toBeDefined();
      expect(models["claude-sonnet-4-5-thinking"]).toBeDefined();
    });

    it("should not add provider.anthropic.models when Claude not selected", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasClaude = false;

      const config = await generateOpencodeConfig(answers, "/test/config");

      if (config.provider) {
        const provider = config.provider as Record<string, unknown>;
        expect(provider.anthropic).toBeUndefined();
      }
    });
  });

  describe("OpenAI provider models", () => {
    it("should add provider.openai.models when OpenAI selected", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasOpenAI = true;

      const config = await generateOpencodeConfig(answers, "/test/config");

      expect(config.provider).toBeDefined();
      const provider = config.provider as Record<string, unknown>;
      expect(provider.openai).toBeDefined();

      const openai = provider.openai as Record<string, unknown>;
      expect(openai.models).toBeDefined();

      const models = openai.models as Record<string, unknown>;
      expect(models["gpt-5.1-high"]).toBeDefined();
    });

    it("should not add provider.openai.models when OpenAI not selected", async () => {
      const answers = createBaseAnswers();
      answers.subscriptions.hasOpenAI = false;

      const config = await generateOpencodeConfig(answers, "/test/config");

      if (config.provider) {
        const provider = config.provider as Record<string, unknown>;
        expect(provider.openai).toBeUndefined();
      }
    });
  });
});
