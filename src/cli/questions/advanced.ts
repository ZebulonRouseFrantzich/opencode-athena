/**
 * Advanced questions
 *
 * Gather advanced configuration options.
 */

import { checkbox, select } from "@inquirer/prompts";
import type { AdvancedAnswers } from "../../shared/types.js";

/**
 * Default values for advanced questions
 */
export interface AdvancedDefaults {
  parallelStoryLimit?: number;
  experimental?: string[];
}

/**
 * Gather advanced options from user
 *
 * @param defaults - Optional default values from a preset
 */
export async function gatherAdvanced(defaults?: AdvancedDefaults): Promise<AdvancedAnswers> {
  const parallelStoryLimit = await select({
    message: "Maximum parallel stories?",
    choices: [
      { name: "1 (sequential - one story at a time)", value: 1 },
      { name: "2", value: 2 },
      { name: "3 (recommended)", value: 3 },
      { name: "5", value: 5 },
      { name: "Unlimited (0)", value: 0 },
    ],
    default: defaults?.parallelStoryLimit ?? 3,
  });

  // Determine which experimental features are checked by default
  const experimentalDefaults = new Set(defaults?.experimental ?? []);

  const experimental = await checkbox({
    message: "Enable experimental features?",
    choices: [
      {
        name: "Aggressive Truncation - More aggressive context management",
        value: "aggressive-truncation",
        checked: experimentalDefaults.has("aggressive-truncation"),
      },
      {
        name: "Auto Resume - Automatically resume interrupted sessions",
        value: "auto-resume",
        checked: experimentalDefaults.has("auto-resume"),
      },
    ],
  });

  return {
    parallelStoryLimit,
    experimental,
  };
}
