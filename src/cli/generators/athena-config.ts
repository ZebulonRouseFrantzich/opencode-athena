/**
 * Athena config generator
 *
 * Generates the athena.json configuration file.
 */

import { VERSION } from "../../shared/constants.js";
import type { InstallAnswers } from "../../shared/types.js";
import { featuresToFlags, mcpsToFlags } from "../questions/features.js";

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
    },
    features: featuresToFlags(features.enabledFeatures),
    mcps: mcpsToFlags(features.mcps),
  };
}
