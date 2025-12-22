/**
 * Model selection questions
 *
 * Allow users to select specific models for each agent role.
 */

import { select } from "@inquirer/prompts";
import type { ModelAnswers, ModelChoice, SubscriptionAnswers } from "../../shared/types.js";

/**
 * Default values for model questions
 */
export interface ModelDefaults {
  sisyphus?: string;
  oracle?: string;
  librarian?: string;
  frontend?: string;
  documentWriter?: string;
  multimodalLooker?: string;
}

/**
 * Available models by provider
 */
const AVAILABLE_MODELS: ModelChoice[] = [
  // Anthropic models
  {
    id: "anthropic/claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Latest Sonnet - balanced performance and speed",
  },
  {
    id: "anthropic/claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    description: "Most capable Claude model",
  },
  {
    id: "anthropic/claude-sonnet-4-5-thinking",
    name: "Claude Sonnet 4.5 (Thinking)",
    provider: "anthropic",
    description: "Sonnet with extended thinking enabled",
  },
  {
    id: "anthropic/claude-opus-4-5-thinking",
    name: "Claude Opus 4.5 (Thinking)",
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
    id: "openai/gpt-5.1",
    name: "GPT-5.1",
    provider: "openai",
    description: "Latest GPT model",
  },
  {
    id: "openai/gpt-5.1-high",
    name: "GPT-5.1 High",
    provider: "openai",
    description: "GPT-5.1 with high reasoning effort",
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
export function getAvailableModels(subscriptions: SubscriptionAnswers): ModelChoice[] {
  return AVAILABLE_MODELS.filter((model) => {
    if (model.provider === "anthropic" && !subscriptions.hasClaude) return false;
    if (model.provider === "openai" && !subscriptions.hasOpenAI) return false;
    if (model.provider === "google" && !subscriptions.hasGoogle) return false;
    return true;
  });
}

/**
 * Check if a model is available given the subscriptions
 */
function isModelAvailable(modelId: string, availableModels: ModelChoice[]): boolean {
  return availableModels.some((m) => m.id === modelId);
}

/**
 * Get a fallback model when preset model is not available
 *
 * @param presetModel - The model from the preset
 * @param role - The agent role
 * @param subscriptions - The user's subscriptions
 * @param availableModels - List of available models
 * @returns A valid model ID, either the preset one or a fallback
 */
function getValidModelOrFallback(
  presetModel: string | undefined,
  role: string,
  subscriptions: SubscriptionAnswers,
  availableModels: ModelChoice[]
): string | undefined {
  // If preset model is available, use it
  if (presetModel && isModelAvailable(presetModel, availableModels)) {
    return presetModel;
  }

  // Otherwise use the role-based suggestion
  return getSuggestedModel(role, subscriptions, availableModels);
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
      "anthropic/claude-opus-4-5-thinking",
      "anthropic/claude-sonnet-4-5-thinking",
      "openai/gpt-5.1-high",
      "google/gemini-2.5-pro",
    ],
    oracle: [
      "openai/gpt-5.1-high",
      "anthropic/claude-opus-4-5-thinking",
      "anthropic/claude-sonnet-4-5-thinking",
      "google/gemini-2.5-pro",
    ],
    librarian: ["anthropic/claude-sonnet-4-5", "openai/gpt-4o", "google/gemini-2.5-flash"],
    frontend: ["anthropic/claude-sonnet-4-5", "google/gemini-2.5-pro", "openai/gpt-4o"],
    documentWriter: ["google/gemini-2.5-pro", "anthropic/claude-sonnet-4-5", "openai/gpt-4o"],
    multimodalLooker: ["google/gemini-2.5-flash", "openai/gpt-4o", "anthropic/claude-sonnet-4-5"],
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
 *
 * @param subscriptions - The user's provider subscriptions
 * @param defaults - Optional default values from a preset
 */
export async function gatherModels(
  subscriptions: SubscriptionAnswers,
  defaults?: ModelDefaults
): Promise<ModelAnswers> {
  const availableModels = getAvailableModels(subscriptions);

  if (availableModels.length === 0) {
    throw new Error(
      "No models available. Please enable at least one provider (Claude, OpenAI, or Google)."
    );
  }

  const choices = createModelChoices(availableModels);

  // Get valid defaults (either from preset if available, or fallback)
  const sisyphusDefault = getValidModelOrFallback(
    defaults?.sisyphus,
    "sisyphus",
    subscriptions,
    availableModels
  );
  const oracleDefault = getValidModelOrFallback(
    defaults?.oracle,
    "oracle",
    subscriptions,
    availableModels
  );
  const librarianDefault = getValidModelOrFallback(
    defaults?.librarian,
    "librarian",
    subscriptions,
    availableModels
  );

  // Required agents
  const sisyphus = await select({
    message: "Model for Sisyphus (main orchestrator - implements stories)?",
    choices,
    default: sisyphusDefault,
  });

  const oracle = await select({
    message: "Model for Oracle (debugging and complex reasoning)?",
    choices,
    default: oracleDefault,
  });

  const librarian = await select({
    message: "Model for Librarian (research and documentation lookup)?",
    choices,
    default: librarianDefault,
  });

  // Optional agents - use defaults with fallback
  const frontend = getValidModelOrFallback(
    defaults?.frontend,
    "frontend",
    subscriptions,
    availableModels
  );
  const documentWriter = getValidModelOrFallback(
    defaults?.documentWriter,
    "documentWriter",
    subscriptions,
    availableModels
  );
  const multimodalLooker = getValidModelOrFallback(
    defaults?.multimodalLooker,
    "multimodalLooker",
    subscriptions,
    availableModels
  );

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

/**
 * Validate that preset models are compatible with given subscriptions.
 * Returns warnings for any models that won't be available.
 */
export function validatePresetModels(
  presetModels: ModelDefaults,
  subscriptions: SubscriptionAnswers
): string[] {
  const warnings: string[] = [];
  const availableModels = getAvailableModels(subscriptions);

  const checkModel = (model: string | undefined, role: string) => {
    if (model && !isModelAvailable(model, availableModels)) {
      warnings.push(
        `Preset model for ${role} (${model}) is not available with your subscriptions. A fallback will be used.`
      );
    }
  };

  checkModel(presetModels.sisyphus, "Sisyphus");
  checkModel(presetModels.oracle, "Oracle");
  checkModel(presetModels.librarian, "Librarian");
  checkModel(presetModels.frontend, "Frontend");
  checkModel(presetModels.documentWriter, "Document Writer");
  checkModel(presetModels.multimodalLooker, "Multimodal Looker");

  return warnings;
}
