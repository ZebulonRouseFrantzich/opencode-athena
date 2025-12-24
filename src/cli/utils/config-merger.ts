import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG_PATHS, VERSION } from "../../shared/constants.js";
import type { InstallAnswers } from "../../shared/types.js";
import { generateAthenaConfig } from "../generators/athena-config.js";
import { generateOmoConfig } from "../generators/omo-config.js";

export interface MergeOptions {
  existingAthena: Record<string, unknown>;
  existingOmo: Record<string, unknown>;
  fullAnswers: InstallAnswers;
}

export interface MergedConfigs {
  athena: Record<string, unknown>;
  omo: Record<string, unknown>;
}

export interface BackupResult {
  athenaBackup: string | null;
  omoBackup: string | null;
  opencodeBackup: string | null;
}

export function deepMerge(
  baseObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...baseObj };

  for (const [key, value] of Object.entries(newObj)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function mergeConfigs(options: MergeOptions): MergedConfigs {
  const { existingAthena, fullAnswers } = options;

  const freshAthena = generateAthenaConfig(fullAnswers);
  const freshOmo = generateOmoConfig(fullAnswers);

  const mergedAthena = deepMerge(existingAthena, freshAthena);
  mergedAthena.version = VERSION;

  return {
    athena: mergedAthena,
    omo: freshOmo,
  };
}

export function createBackups(): BackupResult {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.TZ]/g, "-")
    .replace(/--+/g, "-")
    .replace(/-$/, "");
  const result: BackupResult = {
    athenaBackup: null,
    omoBackup: null,
    opencodeBackup: null,
  };

  if (!existsSync(CONFIG_PATHS.backupsDir)) {
    mkdirSync(CONFIG_PATHS.backupsDir, { recursive: true });
  }

  if (existsSync(CONFIG_PATHS.globalAthenaConfig)) {
    result.athenaBackup = join(CONFIG_PATHS.backupsDir, `athena.json.backup-${timestamp}`);
    copyFileSync(CONFIG_PATHS.globalAthenaConfig, result.athenaBackup);
  }

  if (existsSync(CONFIG_PATHS.globalOmoConfig)) {
    result.omoBackup = join(CONFIG_PATHS.backupsDir, `oh-my-opencode.json.backup-${timestamp}`);
    copyFileSync(CONFIG_PATHS.globalOmoConfig, result.omoBackup);
  }

  if (existsSync(CONFIG_PATHS.globalOpencodeConfig)) {
    result.opencodeBackup = join(CONFIG_PATHS.backupsDir, `opencode.json.backup-${timestamp}`);
    copyFileSync(CONFIG_PATHS.globalOpencodeConfig, result.opencodeBackup);
  }

  return result;
}

export function writeMergedConfigs(configs: MergedConfigs): void {
  const athenaDir = dirname(CONFIG_PATHS.globalAthenaConfig);
  if (!existsSync(athenaDir)) {
    mkdirSync(athenaDir, { recursive: true });
  }

  writeFileSync(CONFIG_PATHS.globalAthenaConfig, JSON.stringify(configs.athena, null, 2), "utf-8");
  writeFileSync(CONFIG_PATHS.globalOmoConfig, JSON.stringify(configs.omo, null, 2), "utf-8");
}
