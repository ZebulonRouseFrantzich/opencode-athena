/**
 * Methodology questions
 *
 * Gather BMAD methodology preferences.
 */

import { confirm, select } from "@inquirer/prompts";
import type { MethodologyAnswers } from "../../shared/types.js";

/**
 * Default values for methodology questions
 */
export interface MethodologyDefaults {
  defaultTrack?: "quick-flow" | "bmad-method" | "enterprise";
  autoStatusUpdate?: boolean;
}

/**
 * Gather methodology preferences from user
 *
 * @param defaults - Optional default values from a preset
 */
export async function gatherMethodology(
  defaults?: MethodologyDefaults
): Promise<MethodologyAnswers> {
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
    default: defaults?.defaultTrack ?? "bmad-method",
  });

  const autoStatusUpdate = await confirm({
    message: "Automatically update sprint-status.yaml when stories complete?",
    default: defaults?.autoStatusUpdate ?? true,
  });

  return {
    defaultTrack,
    autoStatusUpdate,
  };
}
