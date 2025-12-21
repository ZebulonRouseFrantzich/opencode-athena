/**
 * Methodology questions
 *
 * Gather BMAD methodology preferences.
 */

import { confirm, select } from "@inquirer/prompts";
import type { MethodologyAnswers } from "../../shared/types.js";

/**
 * Gather methodology preferences from user
 */
export async function gatherMethodology(): Promise<MethodologyAnswers> {
  const defaultTrack = await select({
    message: "Default BMAD track for new projects?",
    choices: [
      {
        name: "Quick Flow - Fast implementation for small features and bug fixes",
        value: "quick-flow" as const,
      },
      {
        name: "BMad Method - Full planning for products and platforms (recommended)",
        value: "bmad-method" as const,
      },
      {
        name: "Enterprise - Extended planning with compliance and scale considerations",
        value: "enterprise" as const,
      },
    ],
    default: "bmad-method",
  });

  const autoStatusUpdate = await confirm({
    message: "Automatically update sprint-status.yaml when stories complete?",
    default: true,
  });

  return {
    defaultTrack,
    autoStatusUpdate,
  };
}
