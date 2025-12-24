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
});
