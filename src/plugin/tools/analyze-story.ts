import * as fs from "node:fs/promises";
import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type { AnalyzeStoryResult, AthenaConfig } from "../../shared/types.js";
import { getBmadPaths } from "../utils/bmad-finder.js";
import { createPluginLogger } from "../utils/plugin-logger.js";
import { assessStoryComplexity, formatComplexityReport } from "../utils/story-complexity.js";
import {
  formatDecompositionSuggestion,
  generateDecompositionSuggestions,
} from "../utils/story-decomposer.js";
import { normalizeStoryId, resolveStoryIdentifier, stripAtPrefix } from "../utils/story-loader.js";
import { parseStoryTasks } from "../utils/story-parser.js";

const log = createPluginLogger("analyze-story");

export function createAnalyzeStoryTool(ctx: PluginInput, config: AthenaConfig): ToolDefinition {
  return tool({
    description: `Analyze a BMAD story's complexity and suggest decomposition if needed.

Returns:
- Story metrics (task count, subtasks, file size)
- Task-level effort estimates with signals
- Total story points
- Recommendation: proceed, suggest-decomposition, or require-decomposition
- Suggested splits if decomposition is recommended

Use this tool before implementing large stories to check if they should be split.`,

    args: {
      storyId: tool.schema.string().describe("Story ID (e.g., '3.2') or file path to analyze"),
    },

    async execute(args): Promise<string> {
      const result = await analyzeStoryComplexity(ctx, config, args.storyId);

      if (!result.success) {
        return JSON.stringify(result, null, 2);
      }

      const lines: string[] = [];
      lines.push(formatComplexityReport(result.assessment));

      if (result.suggestedSplits && result.suggestedSplits.length > 0) {
        lines.push("");
        lines.push(formatDecompositionSuggestion(result.suggestedSplits, result.storyId));
        lines.push("");
        lines.push("What would you like to do?");
        lines.push("[D] Decompose into sub-stories");
        lines.push("[P] Proceed with full story anyway");
        lines.push("[M] Modify decomposition groupings");
      }

      return lines.join("\n");
    },
  });
}

async function analyzeStoryComplexity(
  ctx: PluginInput,
  config: AthenaConfig,
  requestedStoryId: string
): Promise<AnalyzeStoryResult> {
  log.debug("Analyzing story complexity", { requestedStoryId });

  const paths = await getBmadPaths(ctx.directory, config);
  if (!paths.storiesDir) {
    return {
      success: false,
      storyId: requestedStoryId,
      filename: "",
      assessment: null as unknown as AnalyzeStoryResult["assessment"],
      error: "No stories directory found",
      suggestion:
        paths.suggestion ||
        "Ensure BMAD is set up with a stories directory. Athena supports both legacy (docs/) and v6-alpha (_bmad/ + _bmad-output/) structures.",
    };
  }

  const identifier = stripAtPrefix(requestedStoryId);
  const storyId = normalizeStoryId(identifier);

  const resolved = await resolveStoryIdentifier(paths.storiesDir, identifier, ctx.directory);
  if (!resolved) {
    return {
      success: false,
      storyId,
      filename: "",
      assessment: null as unknown as AnalyzeStoryResult["assessment"],
      error: `Story not found: ${requestedStoryId}`,
      suggestion: "Check the story ID or file path and try again.",
    };
  }

  const storyContent = resolved.content;
  const storyFilename = resolved.filename;
  const storyPath = resolved.path;

  let fileSizeBytes: number;
  try {
    const stats = await fs.stat(storyPath);
    fileSizeBytes = stats.size;
  } catch {
    fileSizeBytes = Buffer.byteLength(storyContent, "utf-8");
  }

  const parsedStory = parseStoryTasks(storyContent, storyId);
  const assessment = assessStoryComplexity(parsedStory, fileSizeBytes);
  assessment.filename = storyFilename;

  let suggestedSplits: AnalyzeStoryResult["suggestedSplits"];

  if (assessment.recommendation !== "proceed") {
    suggestedSplits = generateDecompositionSuggestions(parsedStory, assessment.taskEfforts);
  }

  log.info("Story analysis complete", {
    storyId,
    taskCount: assessment.metrics.taskCount,
    totalPoints: assessment.totalPoints,
    recommendation: assessment.recommendation,
    suggestedSplits: suggestedSplits?.length || 0,
  });

  return {
    success: true,
    storyId,
    filename: storyFilename,
    assessment,
    suggestedSplits,
  };
}
