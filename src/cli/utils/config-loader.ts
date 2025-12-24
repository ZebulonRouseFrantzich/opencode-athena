import { existsSync, readFileSync } from "node:fs";
import { CONFIG_PATHS } from "../../shared/constants.js";
import type {
  AdvancedAnswers,
  FeatureAnswers,
  MethodologyAnswers,
  ModelAnswers,
  SubscriptionAnswers,
} from "../../shared/types.js";

export interface LoadedConfigs {
  athena: Record<string, unknown> | null;
  athenaValid: boolean;
  athenaVersion: string | null;
  omo: Record<string, unknown> | null;
  omoValid: boolean;
}

export function loadExistingConfigs(): LoadedConfigs {
  const result: LoadedConfigs = {
    athena: null,
    athenaValid: false,
    athenaVersion: null,
    omo: null,
    omoValid: false,
  };

  if (existsSync(CONFIG_PATHS.globalAthenaConfig)) {
    try {
      const content = readFileSync(CONFIG_PATHS.globalAthenaConfig, "utf-8");
      result.athena = JSON.parse(content);
      result.athenaVersion = (result.athena?.version as string) || "0.0.1";
      result.athenaValid = result.athena !== null && typeof result.athena.version === "string";
    } catch {}
  }

  if (existsSync(CONFIG_PATHS.globalOmoConfig)) {
    try {
      const content = readFileSync(CONFIG_PATHS.globalOmoConfig, "utf-8");
      result.omo = JSON.parse(content);
      result.omoValid = result.omo !== null;
    } catch {}
  }

  return result;
}

export function extractSubscriptions(athena: Record<string, unknown>): SubscriptionAnswers | null {
  try {
    const subs = athena.subscriptions as Record<string, unknown> | undefined;
    if (!subs) return null;

    const claude = subs.claude as Record<string, unknown> | undefined;
    const openai = subs.openai as Record<string, unknown> | undefined;
    const google = subs.google as Record<string, unknown> | undefined;
    const copilot = subs.githubCopilot as Record<string, unknown> | undefined;

    return {
      hasClaude: claude?.enabled === true,
      claudeTier: (claude?.tier as SubscriptionAnswers["claudeTier"]) || "none",
      hasOpenAI: openai?.enabled === true,
      hasGoogle: google?.enabled === true,
      googleAuth: (google?.authMethod as SubscriptionAnswers["googleAuth"]) || "none",
      hasGitHubCopilot: copilot?.enabled === true,
      copilotPlan: (copilot?.plan as SubscriptionAnswers["copilotPlan"]) || "none",
      copilotEnabledModels: (copilot?.enabledModels as string[]) || [],
    };
  } catch {
    return null;
  }
}

export function extractModels(athena: Record<string, unknown>): ModelAnswers | null {
  try {
    const models = athena.models as Record<string, unknown> | undefined;
    if (!models) return null;

    return {
      sisyphus: (models.sisyphus as string) || "",
      oracle: (models.oracle as string) || "",
      librarian: (models.librarian as string) || "",
      frontend: models.frontend as string | undefined,
      documentWriter: models.documentWriter as string | undefined,
      multimodalLooker: models.multimodalLooker as string | undefined,
      explore: models.explore as string | undefined,
      settings: models.settings as ModelAnswers["settings"],
      custom: models.custom as ModelAnswers["custom"],
    };
  } catch {
    return null;
  }
}

export function extractMethodology(athena: Record<string, unknown>): MethodologyAnswers | null {
  try {
    const bmad = athena.bmad as Record<string, unknown> | undefined;
    if (!bmad) return null;

    return {
      defaultTrack: (bmad.defaultTrack as MethodologyAnswers["defaultTrack"]) || "bmad-method",
      autoStatusUpdate: bmad.autoStatusUpdate !== false,
    };
  } catch {
    return null;
  }
}

export function extractFeatures(athena: Record<string, unknown>): FeatureAnswers | null {
  try {
    const features = athena.features as Record<string, boolean> | undefined;
    const mcps = athena.mcps as Record<string, boolean> | undefined;

    if (!features) return null;

    const enabledFeatures: string[] = [];
    if (features.autoStatus) enabledFeatures.push("auto-status");
    if (features.parallelExecution) enabledFeatures.push("parallel");
    if (features.notifications) enabledFeatures.push("notifications");
    if (features.contextMonitor) enabledFeatures.push("context-monitor");
    if (features.commentChecker) enabledFeatures.push("comment-checker");
    if (features.lspTools) enabledFeatures.push("lsp-tools");

    const mcpList: string[] = [];
    if (mcps?.context7) mcpList.push("context7");
    if (mcps?.exa) mcpList.push("exa");
    if (mcps?.grepApp) mcpList.push("grep_app");

    return {
      enabledFeatures,
      mcps: mcpList,
    };
  } catch {
    return null;
  }
}

export function extractAdvanced(athena: Record<string, unknown>): AdvancedAnswers | null {
  try {
    const bmad = athena.bmad as Record<string, unknown> | undefined;

    return {
      parallelStoryLimit: (bmad?.parallelStoryLimit as number) || 3,
      experimental: [],
    };
  } catch {
    return null;
  }
}

/**
 * Detect features that were added after the user's current version.
 *
 * MAINTENANCE NOTE: When adding new features that require user opt-in during upgrade,
 * add a check here for the feature field being undefined. This function is called
 * during the upgrade flow to prompt users about new features.
 *
 * Example: If adding a new feature "enableAwesomeFeature" in version 0.7.0:
 *   if (features?.enableAwesomeFeature === undefined) {
 *     newFeatures.push("enableAwesomeFeature");
 *   }
 */
export function detectNewFeatures(existingAthena: Record<string, unknown>): string[] {
  const newFeatures: string[] = [];

  const features = existingAthena.features as Record<string, unknown> | undefined;

  if (features?.autoGitOperations === undefined) {
    newFeatures.push("autoGitOperations");
  }

  return newFeatures;
}
