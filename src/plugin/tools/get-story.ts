/**
 * athena_get_story tool
 *
 * Loads the current BMAD story context for implementation.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type { AthenaConfig, GetStoryResult, SprintStatus } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import { getBmadPaths } from "../utils/bmad-finder.js";
import {
  extractRelevantArchitecture,
  extractRelevantPRD,
  generateImplementationInstructions,
} from "../utils/context-builder.js";
import { readSprintStatus } from "../utils/yaml-handler.js";

/**
 * Create the athena_get_story tool
 */
export function createGetStoryTool(
  ctx: PluginInput,
  tracker: StoryTracker,
  _config: AthenaConfig
): ToolDefinition {
  return tool({
    description: `Load the current BMAD story context for implementation.

Returns:
- Story file content with requirements and acceptance criteria
- Relevant architecture sections
- Sprint progress information
- Implementation instructions for using Sisyphus and subagents

Use this tool before starting story implementation to get full context.`,

    args: {
      storyId: tool.schema
        .string()
        .optional()
        .describe(
          "Specific story ID (e.g., '2.3'). If omitted, loads the next pending story from sprint-status.yaml."
        ),
    },

    async execute(args): Promise<string> {
      const result = await getStoryContext(ctx, tracker, args.storyId);
      return JSON.stringify(result, null, 2);
    },
  });
}

/**
 * Get story context implementation
 */
async function getStoryContext(
  ctx: PluginInput,
  tracker: StoryTracker,
  requestedStoryId?: string
): Promise<GetStoryResult> {
  const paths = await getBmadPaths(ctx.directory);
  if (!paths.bmadDir) {
    return {
      error: "No BMAD directory found",
      suggestion: "Run 'npx bmad-method@alpha install' to set up BMAD in this project.",
    };
  }

  // Read sprint status
  const sprint = await readSprintStatus(paths.sprintStatus);
  if (!sprint) {
    return {
      error: "No sprint-status.yaml found",
      suggestion: "Run the sprint-planning workflow with BMAD's SM agent first.",
    };
  }

  // Determine which story to load
  const storyId = requestedStoryId || findNextPendingStory(sprint);
  if (!storyId) {
    return {
      error: "No pending stories found",
      sprintProgress: {
        completed: sprint.completed_stories.length,
        total:
          sprint.completed_stories.length +
          sprint.pending_stories.length +
          sprint.in_progress_stories.length,
      },
      suggestion: "All stories in current sprint are complete!",
    };
  }

  // Load story file
  const storyContent = await loadStoryFile(paths.storiesDir, storyId);
  if (!storyContent) {
    return {
      error: `Story file not found for ${storyId}`,
      suggestion: "Run 'create-story' workflow with BMAD's SM agent.",
    };
  }

  // Load architecture context
  const archContent = await extractRelevantArchitecture(paths.architecture, storyContent);

  // Load PRD context
  const prdContent = await extractRelevantPRD(paths.prd, storyContent);

  // Update tracker with "loading" transitional state
  // The story will be promoted to "in_progress" when athena_update_status is called
  await tracker.setCurrentStory(storyId, {
    content: storyContent,
    status: "loading",
    startedAt: new Date().toISOString(),
  });

  return {
    storyId,
    story: storyContent,
    architecture: archContent || "No architecture document found.",
    prd: prdContent || "No PRD document found.",
    sprint: {
      currentEpic: sprint.current_epic || "Unknown",
      completedStories: sprint.completed_stories.length,
      pendingStories: sprint.pending_stories.length,
      blockedStories: sprint.blocked_stories.length,
    },
    instructions: generateImplementationInstructions(storyId),
  };
}

/**
 * Find the next pending story from sprint status
 */
function findNextPendingStory(sprint: SprintStatus): string | null {
  // First check if there's a designated current story
  if (sprint.current_story) {
    return sprint.current_story;
  }

  // Then check in_progress stories
  if (sprint.in_progress_stories.length > 0) {
    return sprint.in_progress_stories[0];
  }

  // Finally check pending stories
  if (sprint.pending_stories.length > 0) {
    return sprint.pending_stories[0];
  }

  return null;
}

/**
 * Load story file content
 * Tries multiple naming conventions:
 * - story-{epic}-{number}.md (e.g., story-2-3.md)
 * - story-{id}.md (e.g., story-2.3.md)
 * - {id}.md (e.g., 2.3.md)
 */
async function loadStoryFile(storiesDir: string, storyId: string): Promise<string | null> {
  // Generate possible file names
  const possibleNames = [
    `story-${storyId.replace(".", "-")}.md`, // story-2-3.md
    `story-${storyId}.md`, // story-2.3.md
    `${storyId}.md`, // 2.3.md
  ];

  for (const fileName of possibleNames) {
    const filePath = join(storiesDir, fileName);
    if (existsSync(filePath)) {
      try {
        return await readFile(filePath, "utf-8");
      } catch {
        // File not readable, try next path
      }
    }
  }

  return null;
}
