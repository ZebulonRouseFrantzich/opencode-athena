/**
 * athena_config tool
 *
 * View current Athena configuration.
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import type { AthenaConfig } from "../../shared/types.js";
import { VERSION } from "../../shared/constants.js";

/**
 * Create the athena_config tool
 */
export function createConfigTool(config: AthenaConfig): ToolDefinition {
  return tool({
    description: `View the current OpenCode Athena configuration.

Shows:
- Version information
- Subscription settings (Claude, OpenAI, Google)
- Model assignments for each agent role
- BMAD integration settings
- Enabled features and MCP servers`,

    args: {
      section: tool.schema
        .enum(["all", "subscriptions", "models", "bmad", "features", "mcps"])
        .optional()
        .describe("Specific section to view (default: all)"),
    },

    async execute(args): Promise<string> {
      const section = args.section || "all";

      if (section === "all") {
        return JSON.stringify(
          {
            athenaVersion: VERSION,
            configVersion: config.version,
            subscriptions: config.subscriptions,
            models: config.models,
            bmad: config.bmad,
            features: config.features,
            mcps: config.mcps,
          },
          null,
          2
        );
      }

      // Return specific section
      const sectionData: Record<string, unknown> = {
        subscriptions: config.subscriptions,
        models: config.models,
        bmad: config.bmad,
        features: config.features,
        mcps: config.mcps,
      };

      return JSON.stringify(
        {
          section,
          data: sectionData[section] || null,
        },
        null,
        2
      );
    },
  });
}
