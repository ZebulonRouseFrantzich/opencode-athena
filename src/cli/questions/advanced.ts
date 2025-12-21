/**
 * Advanced questions
 *
 * Gather advanced configuration options.
 */

import { checkbox, select } from "@inquirer/prompts";
import type { AdvancedAnswers } from "../../shared/types.js";

/**
 * Gather advanced options from user
 */
export async function gatherAdvanced(): Promise<AdvancedAnswers> {
  const parallelStoryLimit = await select({
    message: "Maximum parallel stories?",
    choices: [
      { name: "1 (sequential - one story at a time)", value: 1 },
      { name: "2", value: 2 },
      { name: "3 (recommended)", value: 3 },
      { name: "5", value: 5 },
      { name: "Unlimited (0)", value: 0 },
    ],
    default: 3,
  });

  const experimental = await checkbox({
    message: "Enable experimental features?",
    choices: [
      {
        name: "Aggressive Truncation - More aggressive context management",
        value: "aggressive-truncation",
      },
      {
        name: "Auto Resume - Automatically resume interrupted sessions",
        value: "auto-resume",
      },
    ],
  });

  return {
    parallelStoryLimit,
    experimental,
  };
}
