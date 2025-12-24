import { describe, expect, it } from "vitest";
import { deepMerge, mergeConfigs } from "../../src/cli/utils/config-merger.js";
import type { InstallAnswers } from "../../src/shared/types.js";

describe("config-merger", () => {
  describe("deepMerge", () => {
    it("merges flat objects", () => {
      const base = { a: 1, b: 2 };
      const update = { b: 3, c: 4 };

      const result = deepMerge(base, update);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("merges nested objects", () => {
      const base = {
        level1: {
          a: 1,
          b: 2,
        },
      };
      const update = {
        level1: {
          b: 3,
          c: 4,
        },
      };

      const result = deepMerge(base, update);

      expect(result.level1).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("preserves deeply nested user customizations", () => {
      const base = {
        models: {
          sisyphus: "model-a",
          settings: {
            sisyphus: { temperature: 0.5 },
          },
        },
      };
      const update = {
        models: {
          sisyphus: "model-b",
        },
      };

      const result = deepMerge(base, update);

      expect((result.models as Record<string, unknown>).sisyphus).toBe("model-b");
      expect(
        ((result.models as Record<string, unknown>).settings as Record<string, unknown>).sisyphus
      ).toEqual({ temperature: 0.5 });
    });

    it("replaces arrays instead of merging them", () => {
      const base = { arr: [1, 2, 3] };
      const update = { arr: [4, 5] };

      const result = deepMerge(base, update);

      expect(result.arr).toEqual([4, 5]);
    });

    it("handles null values", () => {
      const base = { a: 1, b: { c: 2 } };
      const update = { b: null };

      const result = deepMerge(base, update);

      expect(result.b).toBe(null);
    });

    it("adds new nested properties", () => {
      const base = { existing: { a: 1 } };
      const update = { existing: { b: 2 }, newProp: { c: 3 } };

      const result = deepMerge(base, update);

      expect(result.existing).toEqual({ a: 1, b: 2 });
      expect(result.newProp).toEqual({ c: 3 });
    });
  });

  describe("mergeConfigs", () => {
    const mockFullAnswers: InstallAnswers = {
      subscriptions: {
        hasClaude: true,
        claudeTier: "pro",
        hasOpenAI: false,
        hasGoogle: false,
        googleAuth: "none",
        hasGitHubCopilot: false,
        copilotPlan: "none",
        copilotEnabledModels: [],
      },
      models: {
        sisyphus: "claude-sonnet-4-5",
        oracle: "claude-sonnet-4-5",
        librarian: "claude-haiku-4-5",
      },
      methodology: {
        defaultTrack: "bmad-method",
        autoStatusUpdate: true,
      },
      features: {
        enabledFeatures: ["auto-status", "lsp-tools"],
        mcps: ["context7"],
      },
      advanced: {
        parallelStoryLimit: 3,
        experimental: [],
      },
      installLocation: "global",
    };

    it("updates version in merged config", () => {
      const existingAthena = {
        version: "0.4.0",
        subscriptions: {},
      };

      const result = mergeConfigs({
        existingAthena,
        existingOmo: {},
        fullAnswers: mockFullAnswers,
      });

      expect(result.athena.version).toBeDefined();
      expect(result.athena.version).not.toBe("0.4.0");
    });

    it("preserves custom model settings from existing config", () => {
      const existingAthena = {
        version: "0.4.0",
        models: {
          sisyphus: "old-model",
          settings: {
            sisyphus: { temperature: 0.3 },
          },
          custom: [{ id: "custom/model", name: "Custom", provider: "openai" }],
        },
      };

      const result = mergeConfigs({
        existingAthena,
        existingOmo: {},
        fullAnswers: mockFullAnswers,
      });

      const models = result.athena.models as Record<string, unknown>;
      expect(models.custom).toEqual([{ id: "custom/model", name: "Custom", provider: "openai" }]);
    });

    it("generates fresh omo config", () => {
      const result = mergeConfigs({
        existingAthena: { version: "0.4.0" },
        existingOmo: { agents: { old: true } },
        fullAnswers: mockFullAnswers,
      });

      expect(result.omo).toBeDefined();
      expect(result.omo.$schema).toBeDefined();
    });
  });
});
