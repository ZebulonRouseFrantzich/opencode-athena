/**
 * Configuration loader for Athena plugin
 *
 * Loads AthenaConfig from project-local or global config files.
 * Project config takes priority over global config.
 * Uses Zod validation for type safety and clear error messages.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_PATHS, DEFAULTS } from "../../shared/constants.js";
import { AthenaConfigSchema } from "../../shared/schemas.js";
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
export async function loadAthenaConfig(projectDir: string): Promise<AthenaConfig> {
  // Try project-local config first
  const localConfigPath = join(projectDir, ".opencode", "athena.json");
  const localConfig = await loadConfigFile(localConfigPath);

  // Try global config
  const globalConfig = await loadConfigFile(CONFIG_PATHS.globalAthenaConfig);

  // Merge configs: local overrides global, both override defaults
  const merged = mergeConfigs(getDefaultConfig(), globalConfig, localConfig);

  // Validate the final merged config
  return validateConfig(merged);
}

/**
 * Load and parse a JSON config file
 */
async function loadConfigFile(filePath: string): Promise<Partial<AthenaConfig> | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);

    // Perform partial validation to catch obvious errors early
    // We don't require all fields since this is a partial config
    return validatePartialConfig(parsed, filePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn(`[Athena] Invalid JSON in config file ${filePath}:`, error.message);
    } else {
      console.warn(`[Athena] Failed to load config from ${filePath}:`, error);
    }
    return null;
  }
}

/**
 * Validate a partial config file and return it with warnings for invalid fields
 */
function validatePartialConfig(
  config: unknown,
  filePath: string
): Partial<AthenaConfig> | null {
  if (typeof config !== "object" || config === null) {
    console.warn(`[Athena] Config file ${filePath} must be an object`);
    return null;
  }

  const result: Partial<AthenaConfig> = {};
  const configObj = config as Record<string, unknown>;

  // Validate and copy each top-level field
  if ("version" in configObj && typeof configObj.version === "string") {
    result.version = configObj.version;
  }

  if ("$schema" in configObj && typeof configObj.$schema === "string") {
    result.$schema = configObj.$schema;
  }

  // Validate subscriptions
  if ("subscriptions" in configObj && typeof configObj.subscriptions === "object") {
    const subs = configObj.subscriptions as Record<string, unknown>;
    result.subscriptions = {} as AthenaConfig["subscriptions"];

    if (subs.claude && typeof subs.claude === "object") {
      const claude = subs.claude as Record<string, unknown>;
      result.subscriptions.claude = {
        enabled: typeof claude.enabled === "boolean" ? claude.enabled : false,
        tier: isValidTier(claude.tier) ? claude.tier : "none",
      };
    }

    if (subs.openai && typeof subs.openai === "object") {
      const openai = subs.openai as Record<string, unknown>;
      result.subscriptions.openai = {
        enabled: typeof openai.enabled === "boolean" ? openai.enabled : false,
      };
    }

    if (subs.google && typeof subs.google === "object") {
      const google = subs.google as Record<string, unknown>;
      result.subscriptions.google = {
        enabled: typeof google.enabled === "boolean" ? google.enabled : false,
        authMethod: isValidAuthMethod(google.authMethod) ? google.authMethod : "none",
      };
    }
  }

  // Validate models
  if ("models" in configObj && typeof configObj.models === "object") {
    const models = configObj.models as Record<string, unknown>;
    result.models = {} as AthenaConfig["models"];

    for (const key of ["sisyphus", "oracle", "librarian", "frontend", "documentWriter", "multimodalLooker"]) {
      if (key in models && typeof models[key] === "string") {
        (result.models as Record<string, string>)[key] = models[key] as string;
      }
    }
  }

  // Validate bmad
  if ("bmad" in configObj && typeof configObj.bmad === "object") {
    const bmad = configObj.bmad as Record<string, unknown>;
    result.bmad = {} as AthenaConfig["bmad"];

    if (isValidTrack(bmad.defaultTrack)) {
      result.bmad.defaultTrack = bmad.defaultTrack;
    }
    if (typeof bmad.autoStatusUpdate === "boolean") {
      result.bmad.autoStatusUpdate = bmad.autoStatusUpdate;
    }
    if (typeof bmad.parallelStoryLimit === "number") {
      result.bmad.parallelStoryLimit = Math.max(0, Math.min(10, bmad.parallelStoryLimit));
    }
  }

  // Validate features
  if ("features" in configObj && typeof configObj.features === "object") {
    const features = configObj.features as Record<string, unknown>;
    result.features = {} as AthenaConfig["features"];

    for (const key of [
      "bmadBridge",
      "autoStatus",
      "parallelExecution",
      "notifications",
      "contextMonitor",
      "commentChecker",
      "lspTools",
    ]) {
      if (key in features && typeof features[key] === "boolean") {
        (result.features as Record<string, boolean>)[key] = features[key] as boolean;
      }
    }
  }

  // Validate mcps
  if ("mcps" in configObj && typeof configObj.mcps === "object") {
    const mcps = configObj.mcps as Record<string, unknown>;
    result.mcps = {} as AthenaConfig["mcps"];

    for (const key of ["context7", "exa", "grepApp"]) {
      if (key in mcps && typeof mcps[key] === "boolean") {
        (result.mcps as Record<string, boolean>)[key] = mcps[key] as boolean;
      }
    }
  }

  return result;
}

/**
 * Type guard for valid Claude tier
 */
function isValidTier(value: unknown): value is "max5x" | "max20x" | "pro" | "none" {
  return typeof value === "string" && ["max5x", "max20x", "pro", "none"].includes(value);
}

/**
 * Type guard for valid Google auth method
 */
function isValidAuthMethod(value: unknown): value is "antigravity" | "personal" | "api" | "none" {
  return typeof value === "string" && ["antigravity", "personal", "api", "none"].includes(value);
}

/**
 * Type guard for valid BMAD track
 */
function isValidTrack(value: unknown): value is "quick-flow" | "bmad-method" | "enterprise" {
  return typeof value === "string" && ["quick-flow", "bmad-method", "enterprise"].includes(value);
}

/**
 * Validate the final merged config using Zod schema
 */
function validateConfig(config: AthenaConfig): AthenaConfig {
  const result = AthenaConfigSchema.safeParse(config);

  if (!result.success) {
    // Log validation errors but don't fail - use defaults for invalid fields
    console.warn("[Athena] Configuration validation warnings:");
    for (const error of result.error.errors) {
      console.warn(`  - ${error.path.join(".")}: ${error.message}`);
    }

    // Return the original config since we already have defaults
    // The individual fields will be used even if some are invalid
    return config;
  }

  return result.data;
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
function mergeConfigs(...configs: (Partial<AthenaConfig> | null)[]): AthenaConfig {
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
