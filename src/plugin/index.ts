/**
 * OpenCode Athena Plugin
 *
 * The main OpenCode plugin that provides BMAD integration tools and hooks.
 */

import type { Plugin } from "@opencode-ai/plugin";

/**
 * OpenCode Athena plugin factory.
 *
 * Provides:
 * - Custom tools for BMAD story management
 * - Session hooks for context tracking
 * - Tool execution hooks for status updates
 * - Compaction hooks to preserve BMAD context
 */
export const OpenCodeAthena: Plugin = async (_ctx) => {
  // TODO: Implement in Phase 3
  // - Load Athena configuration
  // - Initialize story tracker
  // - Create tools (athena_get_story, athena_update_status, etc.)
  // - Create session hooks
  // - Create tool execution hooks
  // - Create compaction hook

  return {
    // Custom tools for BMAD integration
    // tool: createTools(ctx, tracker, config),
    // Session event handlers
    // event: createSessionHooks(ctx, tracker, config),
    // Tool execution hooks
    // "tool.execute.before": toolHooks.before,
    // "tool.execute.after": toolHooks.after,
    // Compaction hook to preserve BMAD context
    // "experimental.session.compacting": compactionHook,
  };
};

// Default export for OpenCode plugin loader
export default OpenCodeAthena;
