/**
 * Configuration loader for Athena plugin
 *
 * Loads AthenaConfig from project-local or global config files.
 * Project config takes priority over global config.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_PATHS, DEFAULTS } from "../../shared/constants.js";
import type { AthenaConfig } from "../../shared/types.js";

/**
 * Load Athena configuration from available config files.
 *
 * Priority order:
 * 1. Project-local: [projectDir]/.opencode/athena.json
 * 2. Global: ~/.config/opencode/athena.json
 * 3. Default values if no config found
 *
 * @param projectDir - The project directory to search for local config
 * @returns The merged Athena configuration
 */
export async function loadAthenaConfig(
  projectDir: string
): Promise<AthenaConfig> {
  // Try project-local config first
  const localConfigPath = join(projectDir, ".opencode", "athena.json");
  const localConfig = await loadConfigFile(localConfigPath);

  // Try global config
  const globalConfig = await loadConfigFile(CONFIG_PATHS.globalAthenaConfig);

  // Merge configs: local overrides global, both override defaults
  return mergeConfigs(getDefaultConfig(), globalConfig, localConfig);
}

/**
 * Load and parse a JSON config file
 */
async function loadConfigFile(
  filePath: string
): Promise<Partial<AthenaConfig> | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Partial<AthenaConfig>;
  } catch (error) {
    console.warn(`[Athena] Failed to load config from ${filePath}:`, error);
    return null;
  }
}

/**
 * Get default configuration values
 */
function getDefaultConfig(): AthenaConfig {
  return {
    version: "1.0.0",
    subscriptions: {
      claude: { enabled: false, tier: "none" },
      openai: { enabled: false },
      google: { enabled: false, authMethod: "none" },
    },
    models: {
      sisyphus: "anthropic/claude-sonnet-4",
      oracle: "anthropic/claude-sonnet-4",
      librarian: "anthropic/claude-sonnet-4",
    },
    bmad: {
      defaultTrack: DEFAULTS.defaultTrack,
      autoStatusUpdate: DEFAULTS.autoStatusUpdate,
      parallelStoryLimit: DEFAULTS.parallelStoryLimit,
    },
    features: { ...DEFAULTS.features },
    mcps: { ...DEFAULTS.mcps },
  };
}

/**
 * Deep merge multiple config objects
 * Later configs override earlier ones
 */
function mergeConfigs(
  ...configs: (Partial<AthenaConfig> | null)[]
): AthenaConfig {
  const result = getDefaultConfig();

  for (const config of configs) {
    if (!config) continue;

    // Merge top-level primitives
    if (config.version) result.version = config.version;

    // Merge subscriptions
    if (config.subscriptions) {
      if (config.subscriptions.claude) {
        result.subscriptions.claude = {
          ...result.subscriptions.claude,
          ...config.subscriptions.claude,
        };
      }
      if (config.subscriptions.openai) {
        result.subscriptions.openai = {
          ...result.subscriptions.openai,
          ...config.subscriptions.openai,
        };
      }
      if (config.subscriptions.google) {
        result.subscriptions.google = {
          ...result.subscriptions.google,
          ...config.subscriptions.google,
        };
      }
    }

    // Merge models
    if (config.models) {
      result.models = { ...result.models, ...config.models };
    }

    // Merge bmad settings
    if (config.bmad) {
      result.bmad = { ...result.bmad, ...config.bmad };
    }

    // Merge features
    if (config.features) {
      result.features = { ...result.features, ...config.features };
    }

    // Merge mcps
    if (config.mcps) {
      result.mcps = { ...result.mcps, ...config.mcps };
    }
  }

  return result;
}
