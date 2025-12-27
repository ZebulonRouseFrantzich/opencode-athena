/**
 * oh-my-opencode config generator
 *
 * Generates the oh-my-opencode.json configuration file.
 */

import { getProviderParams } from "../../plugin/utils/model-params.js";
import type { AgentRole, AthenaConfig, InstallAnswers } from "../../shared/types.js";

function buildMinimalConfig(answers: InstallAnswers): AthenaConfig {
  const { subscriptions, models, methodology, features, advanced } = answers;

  return {
    version: "0.4.0",
    subscriptions: {
      claude: {
        enabled: subscriptions.hasClaude,
        tier: subscriptions.claudeTier || "none",
      },
      openai: {
        enabled: subscriptions.hasOpenAI,
      },
      google: {
        enabled: subscriptions.hasGoogle,
        authMethod: subscriptions.googleAuth || "none",
      },
      githubCopilot: {
        enabled: subscriptions.hasGitHubCopilot,
        plan: subscriptions.copilotPlan,
        enabledModels: subscriptions.copilotEnabledModels,
      },
    },
    models: {
      sisyphus: models.sisyphus,
      oracle: models.oracle,
      librarian: models.librarian,
      frontend: models.frontend,
      documentWriter: models.documentWriter,
      multimodalLooker: models.multimodalLooker,
      settings: models.settings,
      custom: models.custom,
    },
    bmad: {
      defaultTrack: methodology.defaultTrack,
      autoStatusUpdate: methodology.autoStatusUpdate,
      parallelStoryLimit: advanced.parallelStoryLimit || 3,
    },
    features: {
      bmadBridge: true,
      autoStatus: features.enabledFeatures.includes("auto-status"),
      parallelExecution: features.enabledFeatures.includes("parallel"),
      notifications: features.enabledFeatures.includes("notifications"),
      contextMonitor: features.enabledFeatures.includes("context-monitor"),
      commentChecker: features.enabledFeatures.includes("comment-checker"),
      lspTools: features.enabledFeatures.includes("lsp-tools"),
      autoGitOperations: false,
      todoSync: true,
    },
    mcps: {
      context7: features.mcps.includes("context7"),
      exa: features.mcps.includes("exa"),
      grepApp: features.mcps.includes("grep_app"),
    },
  };
}

/**
 * Generate oh-my-opencode.json configuration
 */
export function generateOmoConfig(answers: InstallAnswers): Record<string, unknown> {
  const { subscriptions, models, features, advanced } = answers;
  const config: AthenaConfig = buildMinimalConfig(answers);

  const omoConfig: Record<string, unknown> = {
    $schema:
      "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
  };

  // Google auth toggle - if using antigravity, disable built-in auth
  if (subscriptions.hasGoogle && subscriptions.googleAuth === "antigravity") {
    omoConfig.google_auth = false;
  }

  const agentConfigs: Array<{ role: AgentRole; omoName: string; modelId: string }> = [
    { role: "sisyphus", omoName: "Sisyphus", modelId: models.sisyphus },
    { role: "oracle", omoName: "oracle", modelId: models.oracle },
    { role: "librarian", omoName: "librarian", modelId: models.librarian },
    {
      role: "frontend",
      omoName: "frontend-ui-ux-engineer",
      modelId: models.frontend || models.sisyphus,
    },
    {
      role: "documentWriter",
      omoName: "document-writer",
      modelId: models.documentWriter || models.librarian,
    },
    {
      role: "multimodalLooker",
      omoName: "multimodal-looker",
      modelId: models.multimodalLooker || models.librarian,
    },
    { role: "explore", omoName: "explore", modelId: models.explore || models.librarian },
  ];

  omoConfig.agents = {};
  for (const { role, omoName, modelId } of agentConfigs) {
    const providerParams = getProviderParams(modelId, role, config);
    (omoConfig.agents as Record<string, unknown>)[omoName] = {
      model: modelId,
      ...providerParams,
    };
  }

  (omoConfig.agents as Record<string, unknown>).general = {
    model: models.oracle,
    ...getProviderParams(models.oracle, "oracle", config),
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
    omoConfig.disabled_hooks = disabledHooks;
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
    omoConfig.disabled_mcps = disabledMcps;
  }

  // Experimental features
  if (advanced.experimental && advanced.experimental.length > 0) {
    omoConfig.experimental = {};

    if (advanced.experimental.includes("aggressive-truncation")) {
      (omoConfig.experimental as Record<string, unknown>).aggressive_truncation = true;
    }
    if (advanced.experimental.includes("auto-resume")) {
      (omoConfig.experimental as Record<string, unknown>).auto_resume = true;
    }
  }

  return omoConfig;
}
