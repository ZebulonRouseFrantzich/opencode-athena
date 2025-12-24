import type { AgentRole, AgentSettings, AthenaConfig, ThinkingLevel } from "../../shared/types.js";

type ModelFamily = "claude-thinking" | "claude" | "gpt-reasoning" | "gpt" | "gemini" | "copilot";

const MODEL_FAMILY_BASE_TEMPS: Record<ModelFamily, number> = {
  "claude-thinking": 0.3,
  claude: 0.2,
  "gpt-reasoning": 0.2,
  gpt: 0.3,
  gemini: 0.3,
  copilot: 0.25,
};

const ROLE_TEMP_ADJUSTMENTS: Record<AgentRole, number> = {
  oracle: -0.1,
  sisyphus: 0.0,
  librarian: 0.1,
  frontend: 0.2,
  documentWriter: 0.1,
  multimodalLooker: -0.1,
  explore: -0.1,
};

const ROLE_DEFAULT_THINKING: Record<AgentRole, ThinkingLevel> = {
  oracle: "high",
  sisyphus: "medium",
  librarian: "low",
  frontend: "low",
  documentWriter: "low",
  multimodalLooker: "off",
  explore: "off",
};

interface ModelCapabilities {
  supportsTemperature: boolean;
  supportsThinking: boolean;
  thinkingType?: "anthropic" | "openai" | "google";
}

const MODEL_CAPABILITIES: Record<string, Partial<ModelCapabilities>> = {
  "anthropic/claude-sonnet-4-5-thinking": { supportsThinking: true, thinkingType: "anthropic" },
  "anthropic/claude-opus-4-5-thinking": { supportsThinking: true, thinkingType: "anthropic" },
  "anthropic/claude-sonnet-4-5": { supportsTemperature: true },
  "anthropic/claude-opus-4-5": { supportsTemperature: true },
  "openai/gpt-5.1-high": { supportsThinking: true, thinkingType: "openai" },
  "openai/gpt-5.1": { supportsTemperature: false },
  "openai/gpt-5.2": { supportsTemperature: false },
  "openai/gpt-4o": { supportsTemperature: true },
  "google/gemini-2.5-pro": {
    supportsTemperature: true,
    supportsThinking: true,
    thinkingType: "google",
  },
  "google/gemini-2.5-flash": { supportsTemperature: true },
  "google/gemini-3-pro": {
    supportsTemperature: true,
    supportsThinking: true,
    thinkingType: "google",
  },
  "google/gemini-3-flash": {
    supportsTemperature: true,
    supportsThinking: true,
    thinkingType: "google",
  },
};

const COPILOT_DEFAULTS: Partial<ModelCapabilities> = {
  supportsTemperature: false,
  supportsThinking: false,
};

function getModelFamily(modelId: string): ModelFamily {
  if (modelId.startsWith("github-copilot/")) return "copilot";
  if (modelId.includes("thinking")) return "claude-thinking";
  if (modelId.includes("claude")) return "claude";
  if (modelId.includes("gpt-5.1-high") || modelId.includes("o3") || modelId.includes("o1")) {
    return "gpt-reasoning";
  }
  if (modelId.includes("gpt")) return "gpt";
  if (modelId.includes("gemini")) return "gemini";
  return "claude";
}

/**
 * Get the maximum allowed temperature for a model based on its provider.
 * - Anthropic: 0.0-1.0
 * - OpenAI: 0.0-2.0
 * - Google: 0.0-2.0
 * - Copilot: temperature not supported
 */
function getMaxTemperatureForModel(modelId: string): number {
  if (modelId.startsWith("anthropic/") || modelId.includes("claude")) {
    return 1.0;
  }
  if (modelId.startsWith("openai/") || modelId.includes("gpt")) {
    return 2.0;
  }
  if (modelId.startsWith("google/") || modelId.includes("gemini")) {
    return 2.0;
  }
  // Default to conservative 1.0 for unknown providers
  return 1.0;
}

function getModelCapabilities(modelId: string): ModelCapabilities {
  const known = MODEL_CAPABILITIES[modelId];
  if (known) {
    return {
      supportsTemperature: known.supportsTemperature ?? true,
      supportsThinking: known.supportsThinking ?? false,
      thinkingType: known.thinkingType,
    };
  }

  if (modelId.startsWith("github-copilot/")) {
    return {
      supportsTemperature: COPILOT_DEFAULTS.supportsTemperature ?? false,
      supportsThinking: COPILOT_DEFAULTS.supportsThinking ?? false,
    };
  }

  return { supportsTemperature: true, supportsThinking: false };
}

export function getEffectiveTemperature(
  modelId: string,
  role: AgentRole,
  config: AthenaConfig
): number | undefined {
  const roleOverride = config.models.settings?.[role]?.temperature;
  if (roleOverride !== undefined) return roleOverride;

  const modelOverride = config.models.settings?.overrides?.[modelId]?.temperature;
  if (modelOverride !== undefined) return modelOverride;

  const capabilities = getModelCapabilities(modelId);
  if (!capabilities.supportsTemperature) return undefined;

  const family = getModelFamily(modelId);
  const baseTemp = MODEL_FAMILY_BASE_TEMPS[family];
  const adjustment = ROLE_TEMP_ADJUSTMENTS[role];
  const maxTemp = getMaxTemperatureForModel(modelId);

  return Math.max(0, Math.min(maxTemp, baseTemp + adjustment));
}

export function getEffectiveThinkingLevel(
  modelId: string,
  role: AgentRole,
  config: AthenaConfig
): ThinkingLevel | undefined {
  const roleOverride = config.models.settings?.[role]?.thinkingLevel;
  if (roleOverride !== undefined) return roleOverride;

  const modelOverride = config.models.settings?.overrides?.[modelId]?.thinkingLevel;
  if (modelOverride !== undefined) return modelOverride;

  const capabilities = getModelCapabilities(modelId);
  if (!capabilities.supportsThinking) return undefined;

  return ROLE_DEFAULT_THINKING[role];
}

export interface ProviderParams {
  temperature?: number;
  reasoning_effort?: "low" | "medium" | "high";
  thinking_budget?: number;
  thinking_level?: "low" | "medium" | "high";
}

export function getProviderParams(
  modelId: string,
  role: AgentRole,
  config: AthenaConfig
): ProviderParams {
  const result: ProviderParams = {};

  const temperature = getEffectiveTemperature(modelId, role, config);
  if (temperature !== undefined) {
    result.temperature = temperature;
  }

  const thinkingLevel = getEffectiveThinkingLevel(modelId, role, config);
  if (thinkingLevel && thinkingLevel !== "off") {
    const capabilities = getModelCapabilities(modelId);

    switch (capabilities.thinkingType) {
      case "openai":
        result.reasoning_effort = thinkingLevel;
        break;
      case "anthropic":
        result.thinking_budget = thinkingLevelToTokenBudget(thinkingLevel);
        break;
      case "google":
        result.thinking_level = thinkingLevel;
        break;
    }
  }

  return result;
}

function thinkingLevelToTokenBudget(level: ThinkingLevel): number {
  switch (level) {
    case "low":
      return 4096;
    case "medium":
      return 16384;
    case "high":
      return 32768;
    default:
      return 0;
  }
}

export function getAgentSettings(
  modelId: string,
  role: AgentRole,
  config: AthenaConfig
): AgentSettings {
  return {
    temperature: getEffectiveTemperature(modelId, role, config),
    thinkingLevel: getEffectiveThinkingLevel(modelId, role, config),
  };
}

export function modelSupportsTemperature(modelId: string): boolean {
  return getModelCapabilities(modelId).supportsTemperature;
}

export function modelSupportsThinking(modelId: string): boolean {
  return getModelCapabilities(modelId).supportsThinking;
}
