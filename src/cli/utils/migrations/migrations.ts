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
  {
    fromVersion: "0.8.0",
    toVersion: "0.9.0",
    description: "Add BMAD todo sync feature flag: todoSync",
    migrateAthena: (config) => {
      const features = (config.features as Record<string, unknown>) || {};

      if (features.todoSync === undefined) {
        features.todoSync = true;
      }

      return { ...config, features };
    },
  },
  {
    fromVersion: "0.10.0",
    toVersion: "0.10.1",
    description: "Add Google Antigravity provider model configurations to opencode.json",
    migrateOpencode: (config) => {
      const provider = (config.provider as Record<string, unknown>) || {};
      const google = (provider.google as Record<string, unknown>) || {};
      const models = (google.models as Record<string, unknown>) || {};

      if (Object.keys(models).length === 0) {
        return {
          ...config,
          provider: {
            ...provider,
            google: {
              ...google,
              models: {
                "gemini-3-pro-high": {
                  name: "Gemini 3 Pro High (Antigravity)",
                  limit: {
                    context: 1048576,
                    output: 65535,
                  },
                  modalities: {
                    input: ["text", "image", "pdf"],
                    output: ["text"],
                  },
                },
                "gemini-3-pro-low": {
                  name: "Gemini 3 Pro Low (Antigravity)",
                  limit: {
                    context: 1048576,
                    output: 65535,
                  },
                  modalities: {
                    input: ["text", "image", "pdf"],
                    output: ["text"],
                  },
                },
                "gemini-3-flash": {
                  name: "Gemini 3 Flash (Antigravity)",
                  limit: {
                    context: 1048576,
                    output: 65536,
                  },
                  modalities: {
                    input: ["text", "image", "pdf"],
                    output: ["text"],
                  },
                },
                "claude-sonnet-4-5": {
                  name: "Claude Sonnet 4.5 (Antigravity)",
                  limit: {
                    context: 200000,
                    output: 64000,
                  },
                  modalities: {
                    input: ["text", "image", "pdf"],
                    output: ["text"],
                  },
                },
                "claude-sonnet-4-5-thinking": {
                  name: "Claude Sonnet 4.5 Thinking (Antigravity)",
                  limit: {
                    context: 200000,
                    output: 64000,
                  },
                  modalities: {
                    input: ["text", "image", "pdf"],
                    output: ["text"],
                  },
                },
                "claude-opus-4-5-thinking": {
                  name: "Claude Opus 4.5 Thinking (Antigravity)",
                  limit: {
                    context: 200000,
                    output: 64000,
                  },
                  modalities: {
                    input: ["text", "image", "pdf"],
                    output: ["text"],
                  },
                },
                "gpt-oss-120b-medium": {
                  name: "GPT-OSS 120B Medium (Antigravity)",
                  limit: {
                    context: 131072,
                    output: 32768,
                  },
                  modalities: {
                    input: ["text", "image", "pdf"],
                    output: ["text"],
                  },
                },
              },
            },
          },
        };
      }

      return config;
    },
  },
  {
    fromVersion: "0.10.1",
    toVersion: "0.11.0",
    description: "Add provider routing and fallback configuration",
    migrateAthena: (config) => {
      if (!config.routing) {
        const subs = (config.subscriptions as Record<string, { enabled?: boolean }>) || {};
        const priority: string[] = [];

        if (subs.claude?.enabled) priority.push("anthropic");
        if (subs.openai?.enabled) priority.push("openai");
        if (subs.google?.enabled) priority.push("google");
        if (subs.githubCopilot?.enabled) priority.push("github-copilot");

        if (priority.length === 0) {
          priority.push("anthropic", "openai", "google", "github-copilot");
        }

        (config as Record<string, unknown>).routing = {
          providerPriority: priority,
          modelFamilyPriority: {
            claude: priority.filter((p) => p === "anthropic" || p === "github-copilot"),
            gpt: priority.filter((p) => p === "openai" || p === "github-copilot"),
            gemini: priority.filter((p) => p === "google" || p === "github-copilot"),
          },
          agentOverrides: {
            oracle: { requiresThinking: true },
          },
          fallbackBehavior: {
            autoFallback: false,
            retryPeriodMs: 300000,
            notifyOnRateLimit: true,
          },
        };
      }

      return config;
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
