import * as semver from "semver";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, migrateConfigs, needsMigration } from "../../src/cli/utils/migrations/index.js";
import { VERSION } from "../../src/shared/constants.js";

describe("migrations", () => {
  describe("MIGRATIONS array", () => {
    it("has at least one migration defined", () => {
      expect(MIGRATIONS.length).toBeGreaterThan(0);
    });

    it("all migrations have required properties", () => {
      for (const migration of MIGRATIONS) {
        expect(migration.fromVersion).toBeDefined();
        expect(migration.toVersion).toBeDefined();
        expect(migration.description).toBeDefined();
      }
    });

    it("migrations are in ascending version order", () => {
      for (let i = 1; i < MIGRATIONS.length; i++) {
        const prev = MIGRATIONS[i - 1];
        const curr = MIGRATIONS[i];
        const prevVersion = semver.coerce(prev.fromVersion) || "0.0.0";
        const currVersion = semver.coerce(curr.fromVersion) || "0.0.0";
        expect(semver.lte(prevVersion, currVersion)).toBe(true);
      }
    });
  });

  describe("migrateConfigs", () => {
    it("applies migrations to old config", () => {
      const oldAthena = {
        version: "0.0.1",
        features: {},
      };

      const result = migrateConfigs(oldAthena, {}, "0.0.1");

      expect(result.toVersion).toBeDefined();
      expect(result.athenaConfig.version).toBe(result.toVersion);
    });

    it("adds autoGitOperations when migrating from 0.4.0 to 0.5.0", () => {
      const oldAthena = {
        version: "0.4.0",
        features: {
          bmadBridge: true,
          autoStatus: true,
        },
      };

      const result = migrateConfigs(oldAthena, {}, "0.4.0");

      const features = result.athenaConfig.features as Record<string, unknown>;
      expect(features.autoGitOperations).toBe(false);
    });

    it("preserves existing autoGitOperations value", () => {
      const athenaWithGit = {
        version: "0.4.0",
        features: {
          autoGitOperations: true,
        },
      };

      const result = migrateConfigs(athenaWithGit, {}, "0.4.0");

      const features = result.athenaConfig.features as Record<string, unknown>;
      expect(features.autoGitOperations).toBe(true);
    });

    it("adds bmad.paths fields when migrating from 0.7.0 to 0.8.0", () => {
      const oldAthena = {
        version: "0.7.0",
        bmad: {
          defaultTrack: "bmad-method",
          autoStatusUpdate: true,
          parallelStoryLimit: 3,
          paths: {
            stories: null,
          },
        },
        features: { autoGitOperations: false },
      };

      const result = migrateConfigs(oldAthena, {}, "0.7.0");

      const bmad = result.athenaConfig.bmad as Record<string, unknown>;
      const paths = bmad.paths as Record<string, unknown>;
      expect(paths.stories).toBe(null);
      expect(paths.sprintStatus).toBe(null);
      expect(paths.prd).toBe(null);
      expect(paths.architecture).toBe(null);
      expect(paths.epics).toBe(null);
    });

    it("preserves existing bmad.paths values during migration", () => {
      const athenaWithCustomPaths = {
        version: "0.7.0",
        bmad: {
          paths: {
            stories: "custom/stories",
            prd: "custom/prd.md",
          },
        },
        features: { autoGitOperations: false },
      };

      const result = migrateConfigs(athenaWithCustomPaths, {}, "0.7.0");

      const bmad = result.athenaConfig.bmad as Record<string, unknown>;
      const paths = bmad.paths as Record<string, unknown>;
      expect(paths.stories).toBe("custom/stories");
      expect(paths.prd).toBe("custom/prd.md");
      expect(paths.sprintStatus).toBe(null);
      expect(paths.architecture).toBe(null);
      expect(paths.epics).toBe(null);
    });

    it("adds todoSync when migrating from 0.8.0 to 0.9.0", () => {
      const oldAthena = {
        version: "0.8.0",
        bmad: {
          paths: { stories: null, sprintStatus: null, prd: null, architecture: null, epics: null },
        },
        features: { autoGitOperations: false },
      };

      const result = migrateConfigs(oldAthena, {}, "0.8.0");

      const features = result.athenaConfig.features as Record<string, unknown>;
      expect(features.todoSync).toBe(true);
    });

    it("preserves existing todoSync value during migration", () => {
      const athenaWithTodoFlags = {
        version: "0.8.0",
        bmad: { paths: {} },
        features: {
          autoGitOperations: false,
          todoSync: false,
        },
      };

      const result = migrateConfigs(athenaWithTodoFlags, {}, "0.8.0");

      const features = result.athenaConfig.features as Record<string, unknown>;
      expect(features.todoSync).toBe(false);
    });

    it("tracks which migrations were applied", () => {
      const oldAthena = {
        version: "0.0.1",
        features: {},
      };

      const result = migrateConfigs(oldAthena, {}, "0.0.1");

      expect(result.migrationsApplied).toBeInstanceOf(Array);
      expect(result.migrationsApplied.length).toBeGreaterThan(0);
    });

    it("skips migrations when already at current version", () => {
      const currentAthena = {
        version: VERSION,
        features: { autoGitOperations: false },
      };

      const result = migrateConfigs(currentAthena, {}, VERSION);

      expect(result.migrationsApplied).toHaveLength(0);
    });

    it("returns hasBreakingChanges false for minor updates", () => {
      const oldAthena = {
        version: "0.4.0",
        features: {},
      };

      const result = migrateConfigs(oldAthena, {}, "0.4.0");

      expect(result.hasBreakingChanges).toBe(false);
    });
  });

  describe("needsMigration", () => {
    it("returns true for old versions", () => {
      expect(needsMigration("0.0.1")).toBe(true);
      expect(needsMigration("0.4.0")).toBe(true);
    });

    it("returns false for current version", () => {
      expect(needsMigration(VERSION)).toBe(false);
    });

    it("handles invalid version strings gracefully", () => {
      expect(() => needsMigration("invalid")).not.toThrow();
      expect(() => needsMigration("")).not.toThrow();
    });
  });

  describe("migrateConfigs (chain migrations)", () => {
    it("applies all migrations from 0.0.1 to current version", () => {
      const oldAthena = {
        version: "0.0.1",
        features: {},
      };

      const result = migrateConfigs(oldAthena, {}, "0.0.1");

      expect(result.migrationsApplied.length).toBeGreaterThanOrEqual(5);

      const features = result.athenaConfig.features as Record<string, unknown>;
      expect(features.autoGitOperations).toBeDefined();
      expect(features.todoSync).toBe(true);

      const bmad = result.athenaConfig.bmad as Record<string, unknown>;
      const paths = bmad.paths as Record<string, unknown>;
      expect(paths.sprintStatus).toBe(null);
      expect(paths.prd).toBe(null);
      expect(paths.architecture).toBe(null);
      expect(paths.epics).toBe(null);
    });

    it("skips migrations already applied", () => {
      const athena050 = {
        version: "0.5.0",
        features: { autoGitOperations: false },
      };

      const result = migrateConfigs(athena050, {}, "0.5.0");

      expect(result.migrationsApplied).toHaveLength(5);
      expect(result.migrationsApplied[0]).toContain("0.5.0 → 0.6.0");
      expect(result.migrationsApplied[1]).toContain("0.6.0 → 0.7.0");
      expect(result.migrationsApplied[2]).toContain("0.7.0 → 0.8.0");
      expect(result.migrationsApplied[3]).toContain("0.8.0 → 0.9.0");
      expect(result.migrationsApplied[4]).toContain("0.10.0 → 0.10.1");
    });
  });

  describe("Google Antigravity migration (0.10.0 → 0.10.1)", () => {
    it("adds provider.google.models when empty", () => {
      const oldOpencode = {
        plugin: ["opencode-athena/plugin", "oh-my-opencode", "opencode-antigravity-auth"],
        provider: {},
      };

      const result = migrateConfigs({}, {}, "0.10.0", oldOpencode);

      const provider = result.opencodeConfig.provider as Record<string, unknown>;
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

    it("preserves existing google models", () => {
      const oldOpencode = {
        plugin: ["opencode-athena/plugin", "oh-my-opencode", "opencode-antigravity-auth"],
        provider: {
          google: {
            models: {
              "custom-model": {
                name: "Custom Model",
                limit: { context: 100000, output: 10000 },
              },
            },
          },
        },
      };

      const result = migrateConfigs({}, {}, "0.10.0", oldOpencode);

      const provider = result.opencodeConfig.provider as Record<string, unknown>;
      const google = provider.google as Record<string, unknown>;
      const models = google.models as Record<string, unknown>;

      expect(models["custom-model"]).toBeDefined();
      expect(Object.keys(models).length).toBe(1);
    });

    it("does not overwrite existing google.models", () => {
      const oldOpencode = {
        plugin: ["opencode-athena/plugin", "oh-my-opencode", "opencode-antigravity-auth"],
        provider: {
          google: {
            models: {
              "gemini-3-pro-high": {
                name: "Custom Gemini",
                limit: { context: 999999, output: 99999 },
              },
            },
          },
        },
      };

      const result = migrateConfigs({}, {}, "0.10.0", oldOpencode);

      const provider = result.opencodeConfig.provider as Record<string, unknown>;
      const google = provider.google as Record<string, unknown>;
      const models = google.models as Record<string, unknown>;
      const geminiProHigh = models["gemini-3-pro-high"] as Record<string, unknown>;

      expect(geminiProHigh.name).toBe("Custom Gemini");
      expect(geminiProHigh.limit).toEqual({ context: 999999, output: 99999 });
    });

    it("includes correct model metadata for all models", () => {
      const oldOpencode = {
        plugin: ["opencode-athena/plugin", "oh-my-opencode", "opencode-antigravity-auth"],
        provider: {},
      };

      const result = migrateConfigs({}, {}, "0.10.0", oldOpencode);

      const provider = result.opencodeConfig.provider as Record<string, unknown>;
      const google = provider.google as Record<string, unknown>;
      const models = google.models as Record<string, unknown>;

      const geminiProHigh = models["gemini-3-pro-high"] as Record<string, unknown>;
      expect(geminiProHigh.name).toBe("Gemini 3 Pro High (Antigravity)");
      expect(geminiProHigh.limit).toEqual({ context: 1048576, output: 65535 });
      expect(geminiProHigh.modalities).toEqual({
        input: ["text", "image", "pdf"],
        output: ["text"],
      });

      const claudeSonnet = models["claude-sonnet-4-5"] as Record<string, unknown>;
      expect(claudeSonnet.name).toBe("Claude Sonnet 4.5 (Antigravity)");
      expect(claudeSonnet.limit).toEqual({ context: 200000, output: 64000 });

      const gptOss = models["gpt-oss-120b-medium"] as Record<string, unknown>;
      expect(gptOss.name).toBe("GPT-OSS 120B Medium (Antigravity)");
      expect(gptOss.limit).toEqual({ context: 131072, output: 32768 });
    });
  });
});
