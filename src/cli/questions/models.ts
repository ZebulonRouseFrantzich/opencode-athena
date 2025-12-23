/**
 * Model selection questions
 *
 * Allow users to select specific models for each agent role.
 */

import { select } from "@inquirer/prompts";
import type {
  CustomModelDefinition,
  ModelAnswers,
  ModelChoice,
  SubscriptionAnswers,
} from "../../shared/types.js";

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

  // GitHub Copilot models (routed through Copilot - smaller context, no thinking)
  // Free tier models
  {
    id: "github-copilot/gpt-4.1",
    name: "GPT-4.1 (via Copilot)",
    provider: "github-copilot",
    description: "GPT-4.1 through GitHub Copilot",
  },
  {
    id: "github-copilot/gpt-5-mini",
    name: "GPT-5 mini (via Copilot)",
    provider: "github-copilot",
    description: "Fast GPT-5 variant through GitHub Copilot",
  },
  {
    id: "github-copilot/claude-haiku-4.5",
    name: "Claude Haiku 4.5 (via Copilot)",
    provider: "github-copilot",
    description: "Fast Claude model through GitHub Copilot",
  },
  // Pro/Business/Enterprise models
  {
    id: "github-copilot/claude-sonnet-4",
    name: "Claude Sonnet 4 (via Copilot)",
    provider: "github-copilot",
    description: "Claude Sonnet 4 through GitHub Copilot",
  },
  {
    id: "github-copilot/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5 (via Copilot)",
    provider: "github-copilot",
    description: "Latest Sonnet through GitHub Copilot - no thinking mode",
  },
  {
    id: "github-copilot/gpt-5",
    name: "GPT-5 (via Copilot)",
    provider: "github-copilot",
    description: "GPT-5 through GitHub Copilot",
  },
  {
    id: "github-copilot/gpt-5.1",
    name: "GPT-5.1 (via Copilot)",
    provider: "github-copilot",
    description: "GPT-5.1 through GitHub Copilot",
  },
  {
    id: "github-copilot/gpt-5.1-codex",
    name: "GPT-5.1-Codex (via Copilot)",
    provider: "github-copilot",
    description: "Code-optimized GPT-5.1 through GitHub Copilot",
  },
  {
    id: "github-copilot/gpt-5.2",
    name: "GPT-5.2 (via Copilot)",
    provider: "github-copilot",
    description: "Latest GPT through GitHub Copilot",
  },
  {
    id: "github-copilot/gemini-2.5-pro",
    name: "Gemini 2.5 Pro (via Copilot)",
    provider: "github-copilot",
    description: "Gemini 2.5 Pro through GitHub Copilot",
  },
  {
    id: "github-copilot/gemini-3-flash",
    name: "Gemini 3 Flash (via Copilot)",
    provider: "github-copilot",
    description: "Fast Gemini 3 through GitHub Copilot",
  },
  {
    id: "github-copilot/gemini-3-pro",
    name: "Gemini 3 Pro (via Copilot)",
    provider: "github-copilot",
    description: "Gemini 3 Pro through GitHub Copilot",
  },
  // Pro+/Enterprise only (Opus models)
  {
    id: "github-copilot/claude-opus-4.1",
    name: "Claude Opus 4.1 (via Copilot)",
    provider: "github-copilot",
    description: "Claude Opus 4.1 through GitHub Copilot - Pro+/Enterprise only",
  },
  {
    id: "github-copilot/claude-opus-4.5",
    name: "Claude Opus 4.5 (via Copilot)",
    provider: "github-copilot",
    description: "Most capable Claude through GitHub Copilot - Pro+/Enterprise only",
  },
];

type CopilotPlan = SubscriptionAnswers["copilotPlan"];

/**
 * Convert a CustomModelDefinition to a ModelChoice
 */
function customModelToChoice(custom: CustomModelDefinition): ModelChoice {
  return {
    id: custom.id,
    name: custom.name,
    provider: custom.provider,
    description: custom.description,
  };
}

/**
 * Merge custom models with built-in models
 * Custom models with the same ID override built-in models
 */
export function mergeCustomModels(
  builtInModels: ModelChoice[],
  customModels?: CustomModelDefinition[]
): ModelChoice[] {
  if (!customModels || customModels.length === 0) {
    return builtInModels;
  }

  const modelMap = new Map<string, ModelChoice>();
  for (const model of builtInModels) {
    modelMap.set(model.id, model);
  }

  for (const custom of customModels) {
    modelMap.set(custom.id, customModelToChoice(custom));
  }

  return Array.from(modelMap.values());
}

const COPILOT_FREE_MODELS = [
  "github-copilot/gpt-4.1",
  "github-copilot/gpt-5-mini",
  "github-copilot/claude-haiku-4.5",
];

const COPILOT_OPUS_MODELS = ["github-copilot/claude-opus-4.1", "github-copilot/claude-opus-4.5"];

function isModelAvailableForCopilotPlan(modelId: string, plan: CopilotPlan): boolean {
  if (plan === "none") return false;

  if (COPILOT_OPUS_MODELS.includes(modelId)) {
    return plan === "pro-plus" || plan === "enterprise";
  }

  if (plan === "free") {
    return COPILOT_FREE_MODELS.includes(modelId);
  }

  return true;
}

/**
 * Filter models based on enabled providers
 */
export function getAvailableModels(
  subscriptions: SubscriptionAnswers,
  customModels?: CustomModelDefinition[]
): ModelChoice[] {
  const allModels = mergeCustomModels(AVAILABLE_MODELS, customModels);

  return allModels.filter((model) => {
    if (model.provider === "anthropic" && !subscriptions.hasClaude) return false;
    if (model.provider === "openai" && !subscriptions.hasOpenAI) return false;
    if (model.provider === "google" && !subscriptions.hasGoogle) return false;
    if (model.provider === "github-copilot") {
      if (!subscriptions.hasGitHubCopilot) return false;
      if (!isModelAvailableForCopilotPlan(model.id, subscriptions.copilotPlan)) return false;
      if (
        subscriptions.copilotEnabledModels &&
        !subscriptions.copilotEnabledModels.includes(model.id)
      ) {
        return false;
      }
    }
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
 * Prioritizes direct providers, with Copilot models as fallback
 */
function getSuggestedModel(
  role: string,
  _subscriptions: SubscriptionAnswers,
  availableModels: ModelChoice[]
): string | undefined {
  const suggestions: Record<string, string[]> = {
    sisyphus: [
      "anthropic/claude-opus-4-5-thinking",
      "anthropic/claude-sonnet-4-5-thinking",
      "openai/gpt-5.1-high",
      "google/gemini-2.5-pro",
      "github-copilot/claude-sonnet-4.5",
      "github-copilot/gpt-5.1",
      "github-copilot/gemini-2.5-pro",
    ],
    oracle: [
      "openai/gpt-5.1-high",
      "anthropic/claude-opus-4-5-thinking",
      "anthropic/claude-sonnet-4-5-thinking",
      "google/gemini-2.5-pro",
      "github-copilot/gpt-5.1",
      "github-copilot/claude-opus-4.5",
      "github-copilot/claude-sonnet-4.5",
    ],
    librarian: [
      "anthropic/claude-sonnet-4-5",
      "openai/gpt-4o",
      "google/gemini-2.5-flash",
      "github-copilot/claude-haiku-4.5",
      "github-copilot/gpt-5-mini",
    ],
    frontend: [
      "anthropic/claude-sonnet-4-5",
      "google/gemini-2.5-pro",
      "openai/gpt-4o",
      "github-copilot/claude-sonnet-4.5",
      "github-copilot/gemini-2.5-pro",
    ],
    documentWriter: [
      "google/gemini-2.5-pro",
      "anthropic/claude-sonnet-4-5",
      "openai/gpt-4o",
      "github-copilot/gemini-2.5-pro",
      "github-copilot/claude-sonnet-4.5",
    ],
    multimodalLooker: [
      "google/gemini-2.5-flash",
      "openai/gpt-4o",
      "anthropic/claude-sonnet-4-5",
      "github-copilot/gemini-3-flash",
      "github-copilot/gpt-5-mini",
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
 *
 * @param subscriptions - The user's provider subscriptions
 * @param defaults - Optional default values from a preset
 * @param customModels - Optional custom model definitions to include
 */
export async function gatherModels(
  subscriptions: SubscriptionAnswers,
  defaults?: ModelDefaults,
  customModels?: CustomModelDefinition[]
): Promise<ModelAnswers> {
  const availableModels = getAvailableModels(subscriptions, customModels);

  if (availableModels.length === 0) {
    throw new Error(
      "No models available. Please enable at least one provider (Claude, OpenAI, Google, or GitHub Copilot)."
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
export function getModelList(
  subscriptions: SubscriptionAnswers,
  customModels?: CustomModelDefinition[]
): ModelChoice[] {
  return getAvailableModels(subscriptions, customModels);
}

/**
 * Validate that preset models are compatible with given subscriptions.
 * Returns warnings for any models that won't be available.
 */
export function validatePresetModels(
  presetModels: ModelDefaults,
  subscriptions: SubscriptionAnswers,
  customModels?: CustomModelDefinition[]
): string[] {
  const warnings: string[] = [];
  const availableModels = getAvailableModels(subscriptions, customModels);

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
