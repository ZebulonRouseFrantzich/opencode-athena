/**
 * OpenCode Athena Plugin
 *
 * The main OpenCode plugin that provides BMAD integration tools and hooks.
 */

import type { Plugin } from "@opencode-ai/plugin";
import { createTools } from "./tools/index.js";
import {
  createSessionHooks,
  createToolHooks,
  createCompactionHook,
} from "./hooks/index.js";
import { StoryTracker } from "./tracker/story-tracker.js";
import { loadAthenaConfig } from "./utils/config-loader.js";

/**
 * OpenCode Athena plugin factory.
 *
 * Provides:
 * - Custom tools for BMAD story management
 * - Session hooks for context tracking
 * - Tool execution hooks for status updates
 * - Compaction hooks to preserve BMAD context
 */
export const OpenCodeAthena: Plugin = async (ctx) => {
  const { directory } = ctx;

  // Load Athena configuration (project-local takes priority over global)
  const config = await loadAthenaConfig(directory);

  // Initialize story tracker for session state persistence
  const tracker = new StoryTracker(directory);
  await tracker.initialize();

  // Create tools
  const tools = createTools(ctx, tracker, config);

  // Create hooks
  const sessionHooks = createSessionHooks(ctx, tracker, config);
  const toolHooks = createToolHooks(tracker, config);
  const compactionHook = createCompactionHook(tracker);

  return {
    // Custom tools for BMAD integration
    tool: tools,

    // Session event handlers
    event: sessionHooks,

    // Tool execution hooks (stubs for now)
    "tool.execute.before": toolHooks.before,
    "tool.execute.after": toolHooks.after,

    // Compaction hook to preserve BMAD context
    "experimental.session.compacting": compactionHook,
  };
};

// Default export for OpenCode plugin loader
export default OpenCodeAthena;
