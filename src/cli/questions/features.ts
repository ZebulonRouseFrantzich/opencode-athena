/**
 * Feature questions
 *
 * Gather feature toggle preferences.
 */

import { checkbox } from "@inquirer/prompts";
import type { FeatureAnswers } from "../../shared/types.js";

/**
 * Available features with descriptions
 */
const AVAILABLE_FEATURES = [
  {
    name: "BMAD Bridge Commands (/athena-dev, /athena-review, etc.)",
    value: "bmad-bridge",
    checked: true,
  },
  {
    name: "Auto Sprint Status Updates - Update sprint-status.yaml automatically",
    value: "auto-status",
    checked: true,
  },
  {
    name: "Parallel Story Execution - Work on multiple stories simultaneously",
    value: "parallel",
    checked: true,
  },
  {
    name: "Session Notifications - Desktop notifications for completions",
    value: "notifications",
    checked: true,
  },
  {
    name: "Context Window Monitoring - Track context usage",
    value: "context-monitor",
    checked: true,
  },
  {
    name: "Comment Checker - Ensure code is not over-commented",
    value: "comment-checker",
    checked: true,
  },
  {
    name: "LSP Refactoring Tools - Enable lsp_rename, lsp_find_references, etc.",
    value: "lsp-tools",
    checked: true,
  },
];

/**
 * Available MCP servers with descriptions
 */
const AVAILABLE_MCPS = [
  {
    name: "context7 - Documentation lookup and context retrieval",
    value: "context7",
    checked: true,
  },
  {
    name: "websearch_exa - Web search capabilities",
    value: "exa",
    checked: true,
  },
  {
    name: "grep_app - GitHub code search",
    value: "grep_app",
    checked: true,
  },
];

/**
 * Gather feature selections from user
 */
export async function gatherFeatures(): Promise<FeatureAnswers> {
  const enabledFeatures = await checkbox({
    message: "Select features to enable:",
    choices: AVAILABLE_FEATURES,
  });

  const mcps = await checkbox({
    message: "Select MCP servers to enable:",
    choices: AVAILABLE_MCPS,
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
