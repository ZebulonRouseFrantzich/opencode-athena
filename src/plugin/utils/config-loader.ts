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
function validatePartialConfig(config: unknown, filePath: string): Partial<AthenaConfig> | null {
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

    if (subs.githubCopilot && typeof subs.githubCopilot === "object") {
      const copilot = subs.githubCopilot as Record<string, unknown>;
      result.subscriptions.githubCopilot = {
        enabled: typeof copilot.enabled === "boolean" ? copilot.enabled : false,
        plan: isValidCopilotPlan(copilot.plan) ? copilot.plan : "none",
        enabledModels: Array.isArray(copilot.enabledModels)
          ? copilot.enabledModels.filter((m): m is string => typeof m === "string")
          : undefined,
      };
    }
  }

  // Validate models
  if ("models" in configObj && typeof configObj.models === "object") {
    const models = configObj.models as Record<string, unknown>;
    result.models = {} as AthenaConfig["models"];

    const modelKeys = [
      "sisyphus",
      "oracle",
      "librarian",
      "frontend",
      "documentWriter",
      "multimodalLooker",
    ] as const;

    for (const key of modelKeys) {
      if (key in models && typeof models[key] === "string") {
        (result.models as unknown as Record<string, string>)[key] = models[key] as string;
      }
    }

    if ("settings" in models && typeof models.settings === "object" && models.settings !== null) {
      result.models.settings = validateModelSettings(models.settings as Record<string, unknown>);
    }

    if ("custom" in models && Array.isArray(models.custom)) {
      result.models.custom = validateCustomModels(models.custom);
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
 * Type guard for valid GitHub Copilot plan
 */
function isValidCopilotPlan(
  value: unknown
): value is "free" | "pro" | "pro-plus" | "business" | "enterprise" | "none" {
  return (
    typeof value === "string" &&
    ["free", "pro", "pro-plus", "business", "enterprise", "none"].includes(value)
  );
}

/**
 * Type guard for valid BMAD track
 */
function isValidTrack(value: unknown): value is "quick-flow" | "bmad-method" | "enterprise" {
  return typeof value === "string" && ["quick-flow", "bmad-method", "enterprise"].includes(value);
}

function isValidThinkingLevel(value: unknown): value is "off" | "low" | "medium" | "high" {
  return typeof value === "string" && ["off", "low", "medium", "high"].includes(value);
}

function isValidProvider(
  value: unknown
): value is "anthropic" | "openai" | "google" | "github-copilot" {
  return (
    typeof value === "string" && ["anthropic", "openai", "google", "github-copilot"].includes(value)
  );
}

function validateAgentSettings(settings: unknown): AthenaConfig["models"]["settings"] {
  if (typeof settings !== "object" || settings === null) {
    return undefined;
  }

  const result: AthenaConfig["models"]["settings"] = {};
  const settingsObj = settings as Record<string, unknown>;
  const agentKeys = [
    "sisyphus",
    "oracle",
    "librarian",
    "frontend",
    "documentWriter",
    "multimodalLooker",
  ] as const;

  for (const key of agentKeys) {
    if (key in settingsObj && typeof settingsObj[key] === "object" && settingsObj[key] !== null) {
      const agentSetting = settingsObj[key] as Record<string, unknown>;
      const validated: { temperature?: number; thinkingLevel?: "off" | "low" | "medium" | "high" } =
        {};

      if (
        typeof agentSetting.temperature === "number" &&
        agentSetting.temperature >= 0 &&
        agentSetting.temperature <= 2
      ) {
        validated.temperature = agentSetting.temperature;
      }

      if (isValidThinkingLevel(agentSetting.thinkingLevel)) {
        validated.thinkingLevel = agentSetting.thinkingLevel;
      }

      if (Object.keys(validated).length > 0) {
        result[key] = validated;
      }
    }
  }

  if (
    "overrides" in settingsObj &&
    typeof settingsObj.overrides === "object" &&
    settingsObj.overrides !== null
  ) {
    const overrides = settingsObj.overrides as Record<string, unknown>;
    result.overrides = {};

    for (const [modelId, modelSettings] of Object.entries(overrides)) {
      if (typeof modelSettings === "object" && modelSettings !== null) {
        const ms = modelSettings as Record<string, unknown>;
        const validated: {
          temperature?: number;
          thinkingLevel?: "off" | "low" | "medium" | "high";
        } = {};

        if (typeof ms.temperature === "number" && ms.temperature >= 0 && ms.temperature <= 2) {
          validated.temperature = ms.temperature;
        }

        if (isValidThinkingLevel(ms.thinkingLevel)) {
          validated.thinkingLevel = ms.thinkingLevel;
        }

        if (Object.keys(validated).length > 0) {
          result.overrides[modelId] = validated;
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function validateModelSettings(
  settings: Record<string, unknown>
): AthenaConfig["models"]["settings"] {
  return validateAgentSettings(settings);
}

function validateCustomModels(models: unknown[]): AthenaConfig["models"]["custom"] {
  const validated: AthenaConfig["models"]["custom"] = [];

  for (const model of models) {
    if (typeof model !== "object" || model === null) continue;

    const m = model as Record<string, unknown>;
    if (typeof m.id !== "string" || typeof m.name !== "string" || !isValidProvider(m.provider)) {
      continue;
    }

    const customModel: {
      id: string;
      name: string;
      provider: "anthropic" | "openai" | "google" | "github-copilot";
      description?: string;
      capabilities?: { thinking?: boolean; contextWindow?: number; supportsTemperature?: boolean };
    } = {
      id: m.id,
      name: m.name,
      provider: m.provider,
    };

    if (typeof m.description === "string") {
      customModel.description = m.description;
    }

    if (typeof m.capabilities === "object" && m.capabilities !== null) {
      const caps = m.capabilities as Record<string, unknown>;
      customModel.capabilities = {};

      if (typeof caps.thinking === "boolean") {
        customModel.capabilities.thinking = caps.thinking;
      }
      if (typeof caps.contextWindow === "number") {
        customModel.capabilities.contextWindow = caps.contextWindow;
      }
      if (typeof caps.supportsTemperature === "boolean") {
        customModel.capabilities.supportsTemperature = caps.supportsTemperature;
      }
    }

    validated.push(customModel);
  }

  return validated.length > 0 ? validated : undefined;
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
    version: "0.0.1",
    subscriptions: {
      claude: { enabled: false, tier: "none" },
      openai: { enabled: false },
      google: { enabled: false, authMethod: "none" },
      githubCopilot: { enabled: false, plan: "none" },
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
      if (config.subscriptions.githubCopilot) {
        result.subscriptions.githubCopilot = {
          ...result.subscriptions.githubCopilot,
          ...config.subscriptions.githubCopilot,
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
