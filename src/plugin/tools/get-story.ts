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
import { createPluginLogger } from "../utils/plugin-logger.js";
import { loadStoryContent } from "../utils/story-loader.js";
import { readSprintStatus } from "../utils/yaml-handler.js";

const log = createPluginLogger("get-story");

/**
 * Create the athena_get_story tool
 */
export function createGetStoryTool(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig
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
      const result = await getStoryContext(ctx, tracker, config, args.storyId);
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
  config: AthenaConfig,
  requestedStoryId?: string
): Promise<GetStoryResult> {
  log.debug("Getting story context", { requestedStoryId, directory: ctx.directory });

  const paths = await getBmadPaths(ctx.directory, config);
  if (!paths.bmadDir) {
    log.warn("BMAD directory not found", { directory: ctx.directory });
    return {
      error: "No BMAD directory found",
      suggestion: "Run 'npx bmad-method@alpha install' to set up BMAD in this project.",
    };
  }

  // Read sprint status
  log.debug("Reading sprint status", { sprintStatusPath: paths.sprintStatus });
  const sprint = await readSprintStatus(paths.sprintStatus);
  if (!sprint) {
    log.warn("Sprint status file not found", { sprintStatusPath: paths.sprintStatus });
    return {
      error: "No sprint-status.yaml found",
      suggestion: "Run the sprint-planning workflow with BMAD's SM agent first.",
    };
  }

  // Determine which story to load
  const storyId = requestedStoryId || findNextPendingStory(sprint);
  if (!storyId) {
    log.info("No pending stories found", {
      completed: sprint.completed_stories.length,
      pending: sprint.pending_stories.length,
      inProgress: sprint.in_progress_stories.length,
    });
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

  log.debug("Loading story file", { storyId, storiesDir: paths.storiesDir });

  // Load story file
  const storyContent = await loadStoryFile(paths.storiesDir, storyId);
  if (!storyContent) {
    log.error("Story file not found", { storyId, storiesDir: paths.storiesDir });
    return {
      error: `Story file not found for ${storyId}`,
      suggestion: "Run 'create-story' workflow with BMAD's SM agent.",
    };
  }

  // Load architecture context
  log.debug("Extracting relevant architecture sections", {
    architecturePath: paths.architecture,
  });
  const archContent = await extractRelevantArchitecture(paths.architecture, storyContent);

  // Load PRD context
  log.debug("Extracting relevant PRD sections", { prdPath: paths.prd });
  const prdContent = await extractRelevantPRD(paths.prd, storyContent);

  // Update tracker with "loading" transitional state
  // The story will be promoted to "in_progress" when athena_update_status is called
  log.debug("Updating story tracker", { storyId, status: "loading" });
  await tracker.setCurrentStory(storyId, {
    content: storyContent,
    status: "loading",
    startedAt: new Date().toISOString(),
  });

  log.info("Story context loaded successfully", {
    storyId,
    hasArchitecture: !!archContent,
    hasPRD: !!prdContent,
    sprintProgress: {
      completed: sprint.completed_stories.length,
      pending: sprint.pending_stories.length,
      blocked: sprint.blocked_stories.length,
    },
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

async function loadStoryFile(storiesDir: string, storyId: string): Promise<string | null> {
  const result = await loadStoryContent(storiesDir, storyId);
  return result?.content ?? null;
}
