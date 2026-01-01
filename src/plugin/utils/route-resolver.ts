/**
 * Model Route Resolver
 *
 * Resolves a model family (e.g., "claude-sonnet-4-5") to a specific
 * provider route (e.g., "anthropic/claude-sonnet-4-5") based on:
 * 1. Agent-specific overrides
 * 2. Model family priority
 * 3. Global provider priority
 * 4. Capability requirements (thinking, temperature)
 */

import type { AthenaConfig, LLMProvider } from "../../shared/types.js";

interface ModelCapabilities {
  supportsThinking: boolean;
  supportsTemperature: boolean;
}

const MODEL_FAMILIES: Record<string, string> = {
  "claude-sonnet-4-5": "claude-sonnet-4-5",
  "claude-opus-4-5": "claude-opus-4-5",
  "gpt-5.1": "gpt-5.1",
  "gpt-5.1-high": "gpt-5.1-high",
  "gpt-4o": "gpt-4o",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gemini-2.5-flash": "gemini-2.5-flash",
};

const PROVIDER_CAPABILITIES: Record<LLMProvider, ModelCapabilities> = {
  anthropic: { supportsThinking: true, supportsTemperature: true },
  openai: { supportsThinking: true, supportsTemperature: true },
  google: { supportsThinking: true, supportsTemperature: true },
  "github-copilot": { supportsThinking: false, supportsTemperature: false },
};

const MODEL_FAMILY_TO_PROVIDER: Record<string, LLMProvider> = {
  "claude-sonnet-4-5": "anthropic",
  "claude-opus-4-5": "anthropic",
  "gpt-5.1": "openai",
  "gpt-5.1-high": "openai",
  "gpt-4o": "openai",
  "gemini-2.5-pro": "google",
  "gemini-2.5-flash": "google",
};

type AgentRole =
  | "sisyphus"
  | "oracle"
  | "librarian"
  | "frontend"
  | "documentWriter"
  | "multimodalLooker";

export function resolveModelRoute(
  modelFamily: string,
  agentRole: AgentRole,
  config: AthenaConfig
): string {
  const routing = config.routing;
  const agentOverride = routing.agentOverrides[agentRole];

  if (agentOverride?.preferProvider) {
    const route = tryBuildRoute(modelFamily, agentOverride.preferProvider, config);
    if (route) return route;
  }

  if (agentOverride?.requiresThinking) {
    const thinkingProviders = getThinkingCapableProviders(modelFamily, routing);
    for (const provider of thinkingProviders) {
      const route = tryBuildRoute(modelFamily, provider, config);
      if (route) return route;
    }
  }

  const familyType = getModelFamilyType(modelFamily);
  const familyPriority = routing.modelFamilyPriority[familyType];
  if (familyPriority) {
    for (const provider of familyPriority) {
      const route = tryBuildRoute(modelFamily, provider, config);
      if (route) return route;
    }
  }

  for (const provider of routing.providerPriority) {
    const route = tryBuildRoute(modelFamily, provider, config);
    if (route) return route;
  }

  const naturalProvider = MODEL_FAMILY_TO_PROVIDER[modelFamily];
  if (naturalProvider) {
    const route = tryBuildRoute(modelFamily, naturalProvider, config);
    if (route) return route;
  }

  throw new Error(`No available route for model family: ${modelFamily}`);
}

function tryBuildRoute(
  modelFamily: string,
  provider: LLMProvider,
  config: AthenaConfig
): string | null {
  if (!isProviderEnabled(provider, config)) {
    return null;
  }

  const baseModel = MODEL_FAMILIES[modelFamily];
  if (!baseModel) return null;

  if (provider === "github-copilot") {
    return `github-copilot/${baseModel}`;
  }

  return `${provider}/${baseModel}`;
}

function isProviderEnabled(provider: LLMProvider, config: AthenaConfig): boolean {
  const subs = config.subscriptions;

  switch (provider) {
    case "anthropic":
      return subs.claude?.enabled === true;
    case "openai":
      return subs.openai?.enabled === true;
    case "google":
      return subs.google?.enabled === true;
    case "github-copilot":
      return subs.githubCopilot?.enabled === true;
    default:
      return false;
  }
}

function getThinkingCapableProviders(
  modelFamily: string,
  routing: AthenaConfig["routing"]
): LLMProvider[] {
  const familyType = getModelFamilyType(modelFamily);
  const familyPriority = routing.modelFamilyPriority[familyType] || routing.providerPriority;

  return familyPriority.filter((provider) => PROVIDER_CAPABILITIES[provider].supportsThinking);
}

function getModelFamilyType(modelFamily: string): "claude" | "gpt" | "gemini" {
  if (modelFamily.includes("claude")) return "claude";
  if (modelFamily.includes("gpt")) return "gpt";
  if (modelFamily.includes("gemini")) return "gemini";

  throw new Error(`Unknown model family type: ${modelFamily}`);
}

export function maybeSelectThinkingVariant(
  modelFamily: string,
  agentRole: AgentRole,
  config: AthenaConfig
): string {
  const agentOverride = config.routing.agentOverrides[agentRole];

  if (agentOverride?.requiresThinking && supportsThinkingVariant(modelFamily)) {
    return `${modelFamily}-thinking`;
  }

  return modelFamily;
}

function supportsThinkingVariant(modelFamily: string): boolean {
  return modelFamily.includes("claude-sonnet") || modelFamily.includes("claude-opus");
}
