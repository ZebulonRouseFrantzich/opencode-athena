/**
 * Feature questions
 *
 * Gather feature toggle preferences.
 */

import { checkbox } from "@inquirer/prompts";
import type { FeatureAnswers } from "../../shared/types.js";

/**
 * Default values for feature questions
 */
export interface FeatureDefaults {
  enabledFeatures?: string[];
  mcps?: string[];
}

/**
 * Available features with descriptions
 */
const AVAILABLE_FEATURES = [
  {
    name: "BMAD Bridge Commands (/athena-dev, /athena-review, etc.)",
    value: "bmad-bridge",
  },
  {
    name: "Auto Sprint Status Updates - Update sprint-status.yaml automatically",
    value: "auto-status",
  },
  {
    name: "Parallel Story Execution - Work on multiple stories simultaneously",
    value: "parallel",
  },
  {
    name: "Session Notifications - Desktop notifications for completions",
    value: "notifications",
  },
  {
    name: "Context Window Monitoring - Track context usage",
    value: "context-monitor",
  },
  {
    name: "Comment Checker - Ensure code is not over-commented",
    value: "comment-checker",
  },
  {
    name: "LSP Refactoring Tools - Enable lsp_rename, lsp_find_references, etc.",
    value: "lsp-tools",
  },
];

/**
 * All feature values for reference
 */
const ALL_FEATURE_VALUES = AVAILABLE_FEATURES.map((f) => f.value);

/**
 * Available MCP servers with descriptions
 */
const AVAILABLE_MCPS = [
  {
    name: "context7 - Documentation lookup and context retrieval",
    value: "context7",
  },
  {
    name: "websearch_exa - Web search capabilities",
    value: "exa",
  },
  {
    name: "grep_app - GitHub code search",
    value: "grep_app",
  },
];

/**
 * All MCP values for reference
 */
const ALL_MCP_VALUES = AVAILABLE_MCPS.map((m) => m.value);

/**
 * Create choices with checked state based on defaults
 */
function createFeatureChoices(defaults?: string[]) {
  // If no defaults provided, check all by default
  const enabledSet = new Set(defaults ?? ALL_FEATURE_VALUES);

  return AVAILABLE_FEATURES.map((feature) => ({
    ...feature,
    checked: enabledSet.has(feature.value),
  }));
}

/**
 * Create MCP choices with checked state based on defaults
 */
function createMcpChoices(defaults?: string[]) {
  // If no defaults provided, check all by default
  const enabledSet = new Set(defaults ?? ALL_MCP_VALUES);

  return AVAILABLE_MCPS.map((mcp) => ({
    ...mcp,
    checked: enabledSet.has(mcp.value),
  }));
}

/**
 * Gather feature selections from user
 *
 * @param defaults - Optional default values from a preset
 */
export async function gatherFeatures(defaults?: FeatureDefaults): Promise<FeatureAnswers> {
  const enabledFeatures = await checkbox({
    message: "Select features to enable:",
    choices: createFeatureChoices(defaults?.enabledFeatures),
  });

  const mcps = await checkbox({
    message: "Select MCP servers to enable:",
    choices: createMcpChoices(defaults?.mcps),
  });

  return {
    enabledFeatures,
    mcps,
  };
}

/**
 * Get feature flags from enabled features array
 */
export function featuresToFlags(enabledFeatures: string[]): Record<string, boolean> {
  return {
    bmadBridge: enabledFeatures.includes("bmad-bridge"),
    autoStatus: enabledFeatures.includes("auto-status"),
    parallelExecution: enabledFeatures.includes("parallel"),
    notifications: enabledFeatures.includes("notifications"),
    contextMonitor: enabledFeatures.includes("context-monitor"),
    commentChecker: enabledFeatures.includes("comment-checker"),
    lspTools: enabledFeatures.includes("lsp-tools"),
  };
}

/**
 * Get MCP flags from enabled MCPs array
 */
export function mcpsToFlags(mcps: string[]): Record<string, boolean> {
  return {
    context7: mcps.includes("context7"),
    exa: mcps.includes("exa"),
    grepApp: mcps.includes("grep_app"),
  };
}
