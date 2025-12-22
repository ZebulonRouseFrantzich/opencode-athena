/**
 * athena_parallel tool (STUB)
 *
 * Multi-story parallel execution using background agents.
 *
 * TODO: This tool depends on oh-my-opencode's background agent feature.
 * Implementation should:
 * 1. Validate that stories are independent (no file conflicts)
 * 2. Mark all stories as in_progress
 * 3. Spawn background agents for each story
 * 4. Coordinate completion and status updates
 *
 * See: https://github.com/code-yeongyu/oh-my-opencode for background agent API
 */

import { type ToolDefinition, tool } from "@opencode-ai/plugin";

/**
 * Create the athena_parallel tool (stub)
 */
export function createParallelTool(): ToolDefinition {
  return tool({
    description: `Execute multiple independent stories in parallel using background agents.

NOTE: This feature is not yet implemented. It requires integration with oh-my-opencode's background agent system.

When implemented, this tool will:
1. Validate that the specified stories have no file conflicts
2. Mark all stories as in_progress in sprint-status.yaml
3. Spawn background agents to implement each story
4. Coordinate completion and report results`,

    args: {
      storyIds: tool.schema
        .array(tool.schema.string())
        .describe("Array of story IDs to execute in parallel"),
      waitForCompletion: tool.schema
        .boolean()
        .optional()
        .describe("Whether to wait for all stories to complete (default: true)"),
    },

    async execute(args): Promise<string> {
      // TODO: Implement parallel story execution with oh-my-opencode background agents
      return JSON.stringify(
        {
          error: "Not implemented",
          message:
            "Parallel story execution is not yet implemented. This feature requires integration with oh-my-opencode's background agent system.",
          requestedStories: args.storyIds,
          suggestion: "For now, implement stories sequentially using /athena-dev for each story.",
        },
        null,
        2
      );
    },
  });
}
