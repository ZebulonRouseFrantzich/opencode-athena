/**
 * Input validators
 *
 * Validation functions for CLI inputs and configuration.
 */

import { existsSync, readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { AthenaConfigSchema, SprintStatusSchema } from "../../shared/schemas.js";
import type { AthenaConfig } from "../../shared/types.js";

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate an Athena configuration object
 */
export function validateAthenaConfig(config: unknown): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const parseResult = AthenaConfigSchema.safeParse(config);

  if (!parseResult.success) {
    result.valid = false;
    for (const issue of parseResult.error.issues) {
      result.errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
  }

  return result;
}

/**
 * Validate a sprint-status.yaml file
 */
export function validateSprintStatus(path: string): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!existsSync(path)) {
    result.valid = false;
    result.errors.push("File does not exist");
    return result;
  }

  try {
    const content = readFileSync(path, "utf-8");
    const data = parseYaml(content);
    const parseResult = SprintStatusSchema.safeParse(data);

    if (!parseResult.success) {
      result.valid = false;
      for (const issue of parseResult.error.issues) {
        result.errors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
    }
  } catch (err) {
    result.valid = false;
    result.errors.push(err instanceof Error ? err.message : "Invalid YAML");
  }

  return result;
}

/**
 * Validate a JSON configuration file
 */
export function validateJsonConfig(path: string): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (!existsSync(path)) {
    result.valid = false;
    result.errors.push("File does not exist");
    return result;
  }

  try {
    const content = readFileSync(path, "utf-8");
    JSON.parse(content);
  } catch (err) {
    result.valid = false;
    result.errors.push(err instanceof Error ? err.message : "Invalid JSON");
  }

  return result;
}

/**
 * Validate model selection based on available providers
 */
export function validateModelForProvider(
  model: string,
  providers: { claude: boolean; openai: boolean; google: boolean }
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const modelLower = model.toLowerCase();

  // Check if model matches an enabled provider
  const claudeModels = ["claude", "opus", "sonnet", "haiku"];
  const openaiModels = ["gpt", "o1", "o3"];
  const googleModels = ["gemini", "palm"];

  const isClaude = claudeModels.some((m) => modelLower.includes(m));
  const isOpenAI = openaiModels.some((m) => modelLower.includes(m));
  const isGoogle = googleModels.some((m) => modelLower.includes(m));

  if (isClaude && !providers.claude) {
    result.valid = false;
    result.errors.push("Claude model selected but Claude provider is not enabled");
  }

  if (isOpenAI && !providers.openai) {
    result.valid = false;
    result.errors.push("OpenAI model selected but OpenAI provider is not enabled");
  }

  if (isGoogle && !providers.google) {
    result.valid = false;
    result.errors.push("Google model selected but Google provider is not enabled");
  }

  return result;
}

/**
 * Check if Athena config has all required agent models configured
 */
export function validateAgentModels(config: AthenaConfig): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const requiredAgents = ["sisyphus", "oracle", "librarian"];

  const models = (config as AthenaConfig & { models?: Record<string, string> }).models || {};

  for (const agent of requiredAgents) {
    if (!models[agent]) {
      result.warnings.push(`No model configured for agent: ${agent}`);
    }
  }

  return result;
}

/**
 * Validate a preset name
 */
export function isValidPreset(preset: string): boolean {
  const validPresets = ["minimal", "standard", "enterprise", "solo-quick"];
  return validPresets.includes(preset);
}

/**
 * Validate story ID format
 */
export function isValidStoryId(storyId: string): boolean {
  // Accepts formats like "2.3", "1.1", "10.15", etc.
  return /^\d+\.\d+$/.test(storyId);
}

/**
 * Sanitize a string for use in filenames
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
