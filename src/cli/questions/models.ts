/**
 * Model selection questions
 *
 * Allow users to select specific models for each agent role.
 */

import { select } from "@inquirer/prompts";
import type { ModelAnswers, ModelChoice, SubscriptionAnswers } from "../../shared/types.js";

/**
 * Available models by provider
 */
const AVAILABLE_MODELS: ModelChoice[] = [
  // Anthropic models
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "Latest Sonnet - balanced performance and speed",
  },
  {
    id: "anthropic/claude-opus-4-20250514",
    name: "Claude Opus 4",
    provider: "anthropic",
    description: "Most capable Claude model",
  },
  {
    id: "anthropic/claude-sonnet-4-20250514-thinking",
    name: "Claude Sonnet 4 (Thinking)",
    provider: "anthropic",
    description: "Sonnet with extended thinking enabled",
  },
  {
    id: "anthropic/claude-opus-4-20250514-thinking",
    name: "Claude Opus 4 (Thinking)",
    provider: "anthropic",
    description: "Opus with extended thinking enabled",
  },

  // OpenAI models
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Fast multimodal model",
  },
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "Latest GPT-4 variant",
  },
  {
    id: "openai/o1",
    name: "o1",
    provider: "openai",
    description: "Reasoning model for complex tasks",
  },
  {
    id: "openai/o3",
    name: "o3",
    provider: "openai",
    description: "Latest reasoning model",
  },

  // Google models
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Latest Gemini Pro model",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast Gemini model",
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Previous generation fast model",
  },
];

/**
 * Filter models based on enabled providers
 */
function getAvailableModels(subscriptions: SubscriptionAnswers): ModelChoice[] {
  return AVAILABLE_MODELS.filter((model) => {
    if (model.provider === "anthropic" && !subscriptions.hasClaude) return false;
    if (model.provider === "openai" && !subscriptions.hasOpenAI) return false;
    if (model.provider === "google" && !subscriptions.hasGoogle) return false;
    return true;
  });
}

/**
 * Create choices for a select prompt
 */
function createModelChoices(models: ModelChoice[]) {
  return models.map((model) => ({
    name: `${model.name} - ${model.description}`,
    value: model.id,
  }));
}

/**
 * Get a suggested default model for a role based on subscriptions
 */
function getSuggestedModel(
  role: string,
  _subscriptions: SubscriptionAnswers,
  availableModels: ModelChoice[]
): string | undefined {
  // Default suggestions based on role
  const suggestions: Record<string, string[]> = {
    sisyphus: [
      "anthropic/claude-opus-4-20250514-thinking",
      "anthropic/claude-sonnet-4-20250514-thinking",
      "openai/o3",
      "google/gemini-2.5-pro",
    ],
    oracle: [
      "openai/o3",
      "openai/o1",
      "anthropic/claude-opus-4-20250514-thinking",
      "google/gemini-2.5-pro",
    ],
    librarian: ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o", "google/gemini-2.5-flash"],
    frontend: ["anthropic/claude-sonnet-4-20250514", "google/gemini-2.5-pro", "openai/gpt-4o"],
    documentWriter: [
      "google/gemini-2.5-pro",
      "anthropic/claude-sonnet-4-20250514",
      "openai/gpt-4o",
    ],
    multimodalLooker: [
      "google/gemini-2.5-flash",
      "openai/gpt-4o",
      "anthropic/claude-sonnet-4-20250514",
    ],
  };

  const roleDefaults = suggestions[role] || [];
  const availableIds = availableModels.map((m) => m.id);

  for (const modelId of roleDefaults) {
    if (availableIds.includes(modelId)) {
      return modelId;
    }
  }

  return availableModels[0]?.id;
}

/**
 * Gather model selections from user
 */
export async function gatherModels(subscriptions: SubscriptionAnswers): Promise<ModelAnswers> {
  const availableModels = getAvailableModels(subscriptions);

  if (availableModels.length === 0) {
    throw new Error(
      "No models available. Please enable at least one provider (Claude, OpenAI, or Google)."
    );
  }

  const choices = createModelChoices(availableModels);

  // Required agents
  const sisyphus = await select({
    message: "Model for Sisyphus (main orchestrator - implements stories)?",
    choices,
    default: getSuggestedModel("sisyphus", subscriptions, availableModels),
  });

  const oracle = await select({
    message: "Model for Oracle (debugging and complex reasoning)?",
    choices,
    default: getSuggestedModel("oracle", subscriptions, availableModels),
  });

  const librarian = await select({
    message: "Model for Librarian (research and documentation lookup)?",
    choices,
    default: getSuggestedModel("librarian", subscriptions, availableModels),
  });

  // Optional agents - use defaults
  const frontend = getSuggestedModel("frontend", subscriptions, availableModels);
  const documentWriter = getSuggestedModel("documentWriter", subscriptions, availableModels);
  const multimodalLooker = getSuggestedModel("multimodalLooker", subscriptions, availableModels);

  return {
    sisyphus,
    oracle,
    librarian,
    frontend,
    documentWriter,
    multimodalLooker,
  };
}

/**
 * Get the list of available models (for display purposes)
 */
export function getModelList(subscriptions: SubscriptionAnswers): ModelChoice[] {
  return getAvailableModels(subscriptions);
}
