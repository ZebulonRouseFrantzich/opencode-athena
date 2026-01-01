/**
 * Athena config generator
 *
 * Generates the athena.json configuration file.
 */

import { VERSION } from "../../shared/constants.js";
import type { InstallAnswers, LLMProvider } from "../../shared/types.js";
import { featuresToFlags, mcpsToFlags } from "../questions/features.js";

function inferProviderPriority(answers: InstallAnswers): LLMProvider[] {
  const { subscriptions } = answers;
  const priority: LLMProvider[] = [];

  if (subscriptions.hasClaude) priority.push("anthropic");
  if (subscriptions.hasOpenAI) priority.push("openai");
  if (subscriptions.hasGoogle) priority.push("google");
  if (subscriptions.hasGitHubCopilot) priority.push("github-copilot");

  if (priority.length === 0) {
    return ["anthropic", "openai", "google", "github-copilot"];
  }

  return priority;
}

/**
 * Generate athena.json configuration
 */
export function generateAthenaConfig(answers: InstallAnswers): Record<string, unknown> {
  const { subscriptions, models, methodology, features, advanced } = answers;

  return {
    $schema:
      "https://raw.githubusercontent.com/ZebulonRouseFrantzich/opencode-athena/main/config/schemas/athena.schema.json",
    version: VERSION,
    subscriptions: {
      claude: {
        enabled: subscriptions.hasClaude,
        tier: subscriptions.claudeTier,
      },
      openai: {
        enabled: subscriptions.hasOpenAI,
      },
      google: {
        enabled: subscriptions.hasGoogle,
        authMethod: subscriptions.googleAuth,
      },
      githubCopilot: {
        enabled: subscriptions.hasGitHubCopilot,
        plan: subscriptions.copilotPlan,
      },
    },
    models: {
      sisyphus: models.sisyphus,
      oracle: models.oracle,
      librarian: models.librarian,
      frontend: models.frontend,
      documentWriter: models.documentWriter,
      multimodalLooker: models.multimodalLooker,
    },
    bmad: {
      defaultTrack: methodology.defaultTrack,
      autoStatusUpdate: methodology.autoStatusUpdate,
      parallelStoryLimit: advanced.parallelStoryLimit ?? 3,
      paths: {
        stories: null,
        sprintStatus: null,
        prd: null,
        architecture: null,
        epics: null,
      },
    },
    features: featuresToFlags(features.enabledFeatures),
    mcps: mcpsToFlags(features.mcps),
    routing: {
      providerPriority: inferProviderPriority(answers),
      modelFamilyPriority: {
        claude: inferProviderPriority(answers).filter(
          (p) => p === "anthropic" || p === "github-copilot"
        ),
        gpt: inferProviderPriority(answers).filter((p) => p === "openai" || p === "github-copilot"),
        gemini: inferProviderPriority(answers).filter(
          (p) => p === "google" || p === "github-copilot"
        ),
      },
      agentOverrides: {
        oracle: {
          requiresThinking: true,
        },
      },
      fallbackBehavior: {
        autoFallback: advanced.autoFallback ?? false,
        retryPeriodMs: 300000,
        notifyOnRateLimit: true,
      },
    },
  };
}
