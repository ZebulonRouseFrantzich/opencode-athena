import type { Migration } from "./types.js";

export const MIGRATIONS: Migration[] = [
  {
    fromVersion: "0.0.1",
    toVersion: "0.1.0",
    description: "Initial version normalization",
    migrateAthena: (config) => config,
  },
  {
    fromVersion: "0.4.0",
    toVersion: "0.5.0",
    description: "Add autoGitOperations feature flag",
    migrateAthena: (config) => {
      const features = (config.features as Record<string, unknown>) || {};
      if (features.autoGitOperations === undefined) {
        features.autoGitOperations = false;
      }
      return { ...config, features };
    },
  },
  {
    fromVersion: "0.5.0",
    toVersion: "0.6.0",
    description: "Migration system infrastructure (no config changes)",
    migrateAthena: (config) => config,
  },
];
