/**
 * oh-my-opencode config generator
 *
 * Generates the oh-my-opencode.json configuration file.
 */

import type { InstallAnswers } from "../../shared/types.js";

/**
 * Generate oh-my-opencode.json configuration
 */
export function generateOmoConfig(answers: InstallAnswers): Record<string, unknown> {
  const { subscriptions, models, features, advanced } = answers;

  const config: Record<string, unknown> = {
    $schema:
      "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
  };

  // Google auth toggle - if using antigravity, disable built-in auth
  if (subscriptions.hasGoogle && subscriptions.googleAuth === "antigravity") {
    config.google_auth = false;
  }

  // Agent model configuration
  config.agents = {
    // Main orchestrator
    Sisyphus: {
      model: models.sisyphus,
    },
    // Debugging/reasoning agent
    oracle: {
      model: models.oracle,
    },
    // Research agent
    librarian: {
      model: models.librarian,
    },
    // UI/UX agent
    "frontend-ui-ux-engineer": {
      model: models.frontend || models.sisyphus,
    },
    // Documentation agent
    "document-writer": {
      model: models.documentWriter || models.librarian,
    },
    // Image analysis agent
    "multimodal-looker": {
      model: models.multimodalLooker || models.librarian,
    },
  };

  // Disabled hooks based on features
  const disabledHooks: string[] = [];

  if (!features.enabledFeatures.includes("context-monitor")) {
    disabledHooks.push("context-window-monitor");
  }
  if (!features.enabledFeatures.includes("comment-checker")) {
    disabledHooks.push("comment-checker");
  }
  if (!features.enabledFeatures.includes("notifications")) {
    disabledHooks.push("session-notification", "background-notification");
  }

  if (disabledHooks.length > 0) {
    config.disabled_hooks = disabledHooks;
  }

  // Disabled MCPs
  const allMcps = ["context7", "websearch_exa", "grep_app"];
  const enabledMcpIds = features.mcps.map((mcp) => {
    // Map feature names to MCP names
    if (mcp === "exa") return "websearch_exa";
    return mcp;
  });
  const disabledMcps = allMcps.filter((mcp) => !enabledMcpIds.includes(mcp));

  if (disabledMcps.length > 0) {
    config.disabled_mcps = disabledMcps;
  }

  // Experimental features
  if (advanced.experimental && advanced.experimental.length > 0) {
    config.experimental = {};

    if (advanced.experimental.includes("aggressive-truncation")) {
      (config.experimental as Record<string, unknown>).aggressive_truncation = true;
    }
    if (advanced.experimental.includes("auto-resume")) {
      (config.experimental as Record<string, unknown>).auto_resume = true;
    }
  }

  return config;
}
