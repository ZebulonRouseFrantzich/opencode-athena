import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_PATHS } from "../../../shared/constants.js";
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
  {
    fromVersion: "0.6.0",
    toVersion: "0.7.0",
    description: "Reorganize athena files into dedicated directory",
    migrateAthena: (config) => config,
  },
  {
    fromVersion: "0.7.0",
    toVersion: "0.8.0",
    description: "Add BMAD path overrides: sprintStatus, prd, architecture, epics",
    migrateAthena: (config) => {
      const bmad = (config.bmad as Record<string, unknown>) || {};
      const paths = (bmad.paths as Record<string, unknown>) || {};

      if (paths.sprintStatus === undefined) {
        paths.sprintStatus = null;
      }
      if (paths.prd === undefined) {
        paths.prd = null;
      }
      if (paths.architecture === undefined) {
        paths.architecture = null;
      }
      if (paths.epics === undefined) {
        paths.epics = null;
      }

      return { ...config, bmad: { ...bmad, paths } };
    },
  },
];

export interface FileMigrationResult {
  stateFileMoved: boolean;
  backupsMoved: number;
}

export function migrateLegacyFiles(): FileMigrationResult {
  const result: FileMigrationResult = {
    stateFileMoved: false,
    backupsMoved: 0,
  };

  if (!existsSync(CONFIG_PATHS.athenaDir)) {
    mkdirSync(CONFIG_PATHS.athenaDir, { recursive: true });
  }

  if (existsSync(CONFIG_PATHS.legacyStateFile) && !existsSync(CONFIG_PATHS.stateFile)) {
    if (!existsSync(CONFIG_PATHS.athenaDir)) {
      mkdirSync(CONFIG_PATHS.athenaDir, { recursive: true });
    }
    copyFileSync(CONFIG_PATHS.legacyStateFile, CONFIG_PATHS.stateFile);
    unlinkSync(CONFIG_PATHS.legacyStateFile);
    result.stateFileMoved = true;
  }

  const backupPattern = /\.(backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3})$/;
  const configDir = CONFIG_PATHS.globalConfigDir;

  if (existsSync(configDir)) {
    const files = readdirSync(configDir);
    const legacyBackups = files.filter((f) => backupPattern.test(f));

    if (legacyBackups.length > 0) {
      if (!existsSync(CONFIG_PATHS.backupsDir)) {
        mkdirSync(CONFIG_PATHS.backupsDir, { recursive: true });
      }

      for (const backupFile of legacyBackups) {
        const sourcePath = join(configDir, backupFile);
        const destPath = join(CONFIG_PATHS.backupsDir, backupFile);

        if (!existsSync(destPath)) {
          renameSync(sourcePath, destPath);
          result.backupsMoved++;
        }
      }
    }
  }

  return result;
}
