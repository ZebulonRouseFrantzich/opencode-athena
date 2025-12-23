/**
 * Subscription questions
 *
 * Gather information about which LLM providers the user has access to.
 */

import { confirm, select } from "@inquirer/prompts";
import type { SubscriptionAnswers } from "../../shared/types.js";

/**
 * Gather subscription information from user
 */
export async function gatherSubscriptions(): Promise<SubscriptionAnswers> {
  const hasClaude = await confirm({
    message: "Do you have a Claude Pro/Max subscription?",
    default: true,
  });

  let claudeTier: SubscriptionAnswers["claudeTier"] = "none";
  if (hasClaude) {
    claudeTier = await select({
      message: "Which Claude tier?",
      choices: [
        { name: "Max 5x - 5x more usage than Pro", value: "max5x" as const },
        { name: "Max 20x - 20x more usage than Pro", value: "max20x" as const },
        { name: "Pro - Standard Pro subscription", value: "pro" as const },
      ],
    });
  }

  const hasOpenAI = await confirm({
    message: "Do you have a ChatGPT Plus/Pro subscription?",
    default: true,
  });

  const hasGoogle = await confirm({
    message: "Will you use Google/Gemini models?",
    default: true,
  });

  let googleAuth: SubscriptionAnswers["googleAuth"] = "none";
  if (hasGoogle) {
    googleAuth = await select({
      message: "Google authentication method?",
      choices: [
        {
          name: "Google Workspace (Antigravity OAuth) - Recommended for Workspace users",
          value: "antigravity" as const,
        },
        {
          name: "Personal Google Account",
          value: "personal" as const,
        },
        {
          name: "API Key - Direct API access",
          value: "api" as const,
        },
      ],
    });
  }

  const hasGitHubCopilot = await confirm({
    message: "Do you have GitHub Copilot access?",
    default: false,
  });

  let copilotPlan: SubscriptionAnswers["copilotPlan"] = "none";
  if (hasGitHubCopilot) {
    copilotPlan = await select({
      message: "Which GitHub Copilot plan?",
      choices: [
        { name: "Enterprise - Full model access including Opus", value: "enterprise" as const },
        { name: "Pro+ - Includes Claude Opus models", value: "pro-plus" as const },
        { name: "Pro - Standard paid plan", value: "pro" as const },
        { name: "Business - Organization plan", value: "business" as const },
        { name: "Free - Limited model access", value: "free" as const },
      ],
    });
  }

  return {
    hasClaude,
    claudeTier,
    hasOpenAI,
    hasGoogle,
    googleAuth,
    hasGitHubCopilot,
    copilotPlan,
  };
}
