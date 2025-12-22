/**
 * Preset Loader Utility
 *
 * Loads and processes preset configuration files for the CLI installer.
 * Presets provide default values for features, models, and settings.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AdvancedAnswers,
  FeatureAnswers,
  MethodologyAnswers,
  ModelAnswers,
} from "../../shared/types.js";

/**
 * Preset configuration structure (matches preset JSON files)
 */
export interface PresetConfig {
  $schema?: string;
  version: string;
  description: string;
  /** Recommended subscriptions - for documentation only, not used as defaults */
  subscriptions: {
    claude: { enabled: boolean; tier: string };
    openai: { enabled: boolean };
    google: { enabled: boolean; authMethod: string };
  };
  models: {
    sisyphus: string;
    oracle: string;
    librarian: string;
    frontend?: string;
    documentWriter?: string;
    multimodalLooker?: string;
  };
  bmad: {
    defaultTrack: "quick-flow" | "bmad-method" | "enterprise";
    autoStatusUpdate: boolean;
    parallelStoryLimit: number;
  };
  features: {
    bmadBridge: boolean;
    autoStatus: boolean;
    parallelExecution: boolean;
    notifications: boolean;
    contextMonitor: boolean;
    commentChecker: boolean;
    lspTools: boolean;
  };
  mcps: {
    context7: boolean;
    exa: boolean;
    grepApp: boolean;
  };
}

/**
 * Preset summary for display purposes
 */
export interface PresetSummary {
  name: string;
  description: string;
  path: string;
}

/**
 * Defaults derived from a preset
 */
export interface PresetDefaults {
  models: ModelAnswers;
  methodology: MethodologyAnswers;
  features: FeatureAnswers;
  advanced: AdvancedAnswers;
}

/**
 * Valid preset names
 */
export const PRESET_NAMES = ["minimal", "standard", "enterprise", "solo-quick"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

/**
 * Get the path to the presets directory.
 * Handles both development and bundled scenarios.
 */
function getPresetsDir(): string {
  const currentFileDir = dirname(fileURLToPath(import.meta.url));

  // After tsup bundling: dist/cli/index.js -> 2 levels up to package root
  const bundledRoot = join(currentFileDir, "..", "..");
  const bundledPresetsDir = join(bundledRoot, "config", "presets");
  if (existsSync(bundledPresetsDir)) {
    return bundledPresetsDir;
  }

  // Unbundled development: src/cli/utils/preset-loader.ts -> 3 levels up
  const devRoot = join(currentFileDir, "..", "..", "..");
  const devPresetsDir = join(devRoot, "config", "presets");
  if (existsSync(devPresetsDir)) {
    return devPresetsDir;
  }

  // Fallback: check if we're in node_modules
  const nodeModulesPath = currentFileDir.split("node_modules")[0];
  if (nodeModulesPath !== currentFileDir) {
    const packagePresetsDir = join(
      nodeModulesPath,
      "node_modules",
      "opencode-athena",
      "config",
      "presets"
    );
    if (existsSync(packagePresetsDir)) {
      return packagePresetsDir;
    }
  }

  throw new Error(
    `Could not find presets directory. Searched:\n  - ${bundledPresetsDir}\n  - ${devPresetsDir}`
  );
}

/**
 * Check if a preset name is valid
 */
export function isValidPresetName(name: string): name is PresetName {
  return PRESET_NAMES.includes(name as PresetName);
}

/**
 * Load a preset configuration by name
 *
 * @param name - The preset name (minimal, standard, enterprise, solo-quick)
 * @returns The parsed preset configuration
 * @throws Error if preset is not found or invalid
 */
export function loadPreset(name: string): PresetConfig {
  if (!isValidPresetName(name)) {
    const validNames = PRESET_NAMES.join(", ");
    throw new Error(`Invalid preset name: "${name}". Valid presets are: ${validNames}`);
  }

  const presetsDir = getPresetsDir();
  const presetPath = join(presetsDir, `${name}.json`);

  if (!existsSync(presetPath)) {
    throw new Error(
      `Preset file not found: ${presetPath}\nThis may indicate a corrupted installation. Try reinstalling opencode-athena.`
    );
  }

  try {
    const content = readFileSync(presetPath, "utf-8");
    const preset = JSON.parse(content) as PresetConfig;

    // Validate required fields
    if (!preset.version || !preset.models || !preset.bmad || !preset.features) {
      throw new Error(`Preset "${name}" is missing required fields`);
    }

    return preset;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in preset file: ${presetPath}\nError: ${error.message}`);
    }
    throw error;
  }
}

/**
 * List all available presets with their descriptions
 *
 * @returns Array of preset summaries
 */
export function listPresets(): PresetSummary[] {
  const presetsDir = getPresetsDir();
  const summaries: PresetSummary[] = [];

  for (const name of PRESET_NAMES) {
    const presetPath = join(presetsDir, `${name}.json`);

    if (existsSync(presetPath)) {
      try {
        const content = readFileSync(presetPath, "utf-8");
        const preset = JSON.parse(content) as PresetConfig;
        summaries.push({
          name,
          description: preset.description || `${name} preset`,
          path: presetPath,
        });
      } catch {
        // Skip invalid presets
        summaries.push({
          name,
          description: `${name} preset (unable to read)`,
          path: presetPath,
        });
      }
    }
  }

  return summaries;
}

/**
 * Convert a preset configuration to default values for the install wizard.
 *
 * Note: Subscriptions are NOT included - they are always gathered from the user.
 *
 * @param preset - The preset configuration
 * @returns Default values for models, methodology, features, and advanced settings
 */
export function presetToDefaults(preset: PresetConfig): PresetDefaults {
  return {
    models: {
      sisyphus: preset.models.sisyphus,
      oracle: preset.models.oracle,
      librarian: preset.models.librarian,
      frontend: preset.models.frontend,
      documentWriter: preset.models.documentWriter,
      multimodalLooker: preset.models.multimodalLooker,
    },
    methodology: {
      defaultTrack: preset.bmad.defaultTrack,
      autoStatusUpdate: preset.bmad.autoStatusUpdate,
    },
    features: {
      enabledFeatures: flagsToFeatures(preset.features),
      mcps: flagsToMcps(preset.mcps),
    },
    advanced: {
      parallelStoryLimit: preset.bmad.parallelStoryLimit,
      experimental: [],
    },
  };
}

/**
 * Convert feature flags object to enabled features array.
 * Reverse of featuresToFlags() in features.ts
 */
function flagsToFeatures(flags: PresetConfig["features"]): string[] {
  const features: string[] = [];

  if (flags.bmadBridge) features.push("bmad-bridge");
  if (flags.autoStatus) features.push("auto-status");
  if (flags.parallelExecution) features.push("parallel");
  if (flags.notifications) features.push("notifications");
  if (flags.contextMonitor) features.push("context-monitor");
  if (flags.commentChecker) features.push("comment-checker");
  if (flags.lspTools) features.push("lsp-tools");

  return features;
}

/**
 * Convert MCP flags object to enabled MCPs array.
 * Reverse of mcpsToFlags() in features.ts
 */
function flagsToMcps(mcps: PresetConfig["mcps"]): string[] {
  const result: string[] = [];

  if (mcps.context7) result.push("context7");
  if (mcps.exa) result.push("exa");
  if (mcps.grepApp) result.push("grep_app");

  return result;
}

/**
 * Get a formatted summary of a preset for display
 *
 * @param preset - The preset configuration
 * @param name - The preset name
 * @returns Formatted string describing the preset
 */
export function formatPresetSummary(preset: PresetConfig, name: string): string {
  const lines: string[] = [];

  lines.push(`Preset: ${name}`);
  lines.push(`Description: ${preset.description}`);
  lines.push("");
  lines.push("Models:");
  lines.push(`  Sisyphus: ${preset.models.sisyphus}`);
  lines.push(`  Oracle: ${preset.models.oracle}`);
  lines.push(`  Librarian: ${preset.models.librarian}`);

  lines.push("");
  lines.push("BMAD Settings:");
  lines.push(`  Default Track: ${preset.bmad.defaultTrack}`);
  lines.push(`  Auto Status Update: ${preset.bmad.autoStatusUpdate ? "Yes" : "No"}`);
  lines.push(`  Parallel Story Limit: ${preset.bmad.parallelStoryLimit}`);

  lines.push("");
  lines.push("Features:");
  const enabledFeatures = flagsToFeatures(preset.features);
  if (enabledFeatures.length > 0) {
    lines.push(`  Enabled: ${enabledFeatures.join(", ")}`);
  } else {
    lines.push("  Enabled: none");
  }

  lines.push("");
  lines.push("MCP Servers:");
  const enabledMcps = flagsToMcps(preset.mcps);
  if (enabledMcps.length > 0) {
    lines.push(`  Enabled: ${enabledMcps.join(", ")}`);
  } else {
    lines.push("  Enabled: none");
  }

  return lines.join("\n");
}
