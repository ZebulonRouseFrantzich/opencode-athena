import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type { AthenaConfig, ReviewScope } from "../../shared/types.js";
import {
  type AgentRecommendation,
  type FindingCounts,
  selectAgentsForReview,
} from "../utils/agent-selector.js";
import { getBmadPaths } from "../utils/bmad-finder.js";
import {
  type ParsedOracleResponse,
  countFindings,
  parseOracleResponse,
} from "../utils/oracle-parser.js";

export interface Phase1AnalyzeResult {
  success: boolean;
  scope: ReviewScope;
  identifier: string;
  error?: string;
  suggestion?: string;

  findings?: FindingCounts;
  recommendedAgents?: AgentRecommendation[];
  reviewDocPath?: string;
  oracleAnalysis?: string;
  storiesContent?: Array<{ id: string; content: string | null }>;
  summary?: string;
}

export function createStoryReviewAnalyzeTool(
  ctx: PluginInput,
  config: AthenaConfig
): ToolDefinition {
  return tool({
    description: `Analyze BMAD stories for security, logic, best practice, and performance gaps.

This tool performs Phase 1 of the party review workflow:
1. Loads stories and architecture context
2. Spawns Oracle agent to analyze for issues
3. Parses findings by severity and category
4. Recommends BMAD agents for discussion
5. Generates and saves a review document

Returns a complete Phase 1 result that can be passed to Phase 2 (athena_story_review_consult) or Phase 3 (athena_party_discussion).

Use this AFTER story creation but BEFORE development to catch issues early.`,

    args: {
      identifier: tool.schema
        .string()
        .describe("Epic number (e.g., '2'), Story ID (e.g., '2.3'), or file path"),
      thorough: tool.schema
        .boolean()
        .optional()
        .describe("Force advanced model for deeper analysis (default: auto-detect)"),
    },

    async execute(args): Promise<string> {
      const result = await executePhase1Analysis(ctx, config, args.identifier, args.thorough);
      return JSON.stringify(result, null, 2);
    },
  });
}

async function executePhase1Analysis(
  ctx: PluginInput,
  config: AthenaConfig,
  identifier: string,
  forceAdvancedModel?: boolean
): Promise<Phase1AnalyzeResult> {
  const paths = await getBmadPaths(ctx.directory, config);
  if (!paths.bmadDir) {
    return {
      success: false,
      scope: "story",
      identifier,
      error: "No BMAD directory found",
      suggestion: "Run 'npx bmad-method@alpha install' to set up BMAD in this project.",
    };
  }

  const scope = detectReviewScope(identifier);
  const reviewsDir = join(paths.bmadDir, "reviews");
  await ensureDirectory(reviewsDir);

  const storiesContent =
    scope === "epic"
      ? await loadEpicStories(paths.storiesDir, identifier)
      : await loadSingleStory(paths.storiesDir, identifier);

  if (storiesContent.length === 0) {
    return {
      success: false,
      scope,
      identifier,
      error: `No stories found for ${scope} ${identifier}`,
      suggestion: `Check that story files exist in ${paths.storiesDir}`,
    };
  }

  const architectureContent = await loadFile(paths.architecture);

  const oraclePrompt = buildOraclePrompt(scope, identifier, storiesContent, architectureContent);

  const oracleResponse = await spawnOracleAndWait(ctx, config, oraclePrompt, forceAdvancedModel);

  if (!oracleResponse.success) {
    return {
      success: false,
      scope,
      identifier,
      error: oracleResponse.error || "Oracle analysis failed",
      suggestion: "Check that the Oracle agent is configured correctly.",
    };
  }

  const parsed = parseOracleResponse(oracleResponse.content || "");
  const findings = countFindings(parsed);
  const recommendedAgents = selectAgentsForReview(findings);

  const reviewDocPath = await saveReviewDocument(
    reviewsDir,
    scope,
    identifier,
    storiesContent,
    parsed,
    oracleResponse.content || ""
  );

  const summary = buildSummary(findings, recommendedAgents);

  return {
    success: true,
    scope,
    identifier,
    findings,
    recommendedAgents,
    reviewDocPath,
    oracleAnalysis: oracleResponse.content,
    storiesContent,
    summary,
  };
}

function detectReviewScope(identifier: string): ReviewScope {
  const isFilePath = identifier.includes("/") || identifier.endsWith(".md");
  if (isFilePath) return "story";

  const cleanId = identifier.replace(/^(epic|story)-/, "");
  return !cleanId.includes(".") && !cleanId.includes("-") ? "epic" : "story";
}

async function ensureDirectory(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function loadEpicStories(
  storiesDir: string,
  epicId: string
): Promise<Array<{ id: string; content: string | null }>> {
  const epicNumber = epicId.replace(/^epic-/, "");

  if (!existsSync(storiesDir)) return [];

  const files = await readdir(storiesDir);
  const storyPattern = new RegExp(`^story-${epicNumber}-(\\d+)\\.md$`);
  const stories: Array<{ id: string; content: string | null }> = [];

  for (const file of files) {
    const match = file.match(storyPattern);
    if (match) {
      const storyId = `${epicNumber}.${match[1]}`;
      const content = await loadFile(join(storiesDir, file));
      stories.push({ id: storyId, content });
    }
  }

  return stories.sort((a, b) => a.id.localeCompare(b.id));
}

async function loadSingleStory(
  storiesDir: string,
  storyId: string
): Promise<Array<{ id: string; content: string | null }>> {
  const normalizedId = storyId.replace(/^story-/, "").replace("-", ".");
  const filename = `story-${normalizedId.replace(".", "-")}.md`;
  const filePath = join(storiesDir, filename);

  if (!existsSync(filePath)) return [];

  const content = await loadFile(filePath);
  return [{ id: normalizedId, content }];
}

async function loadFile(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

function buildOraclePrompt(
  scope: ReviewScope,
  identifier: string,
  stories: Array<{ id: string; content: string | null }>,
  architecture: string | null
): string {
  const storiesText = stories
    .map((s) => `## Story ${s.id}\n\n${s.content || "(empty)"}`)
    .join("\n\n---\n\n");

  const scopeDescription =
    scope === "epic"
      ? `Epic ${identifier} - Review ALL stories for issues AND cross-story patterns`
      : `Story ${identifier} - Deep dive focused review`;

  return `You are a security, logic, and performance expert conducting a "party review" of BMAD stories BEFORE development begins.

**Your Role**: Find issues while they're cheap to fix (in markdown, not code).

**Focus Areas**:
1. 🔒 **Security Gaps**: Missing auth/authorization, input validation, data exposure risks
2. 🧠 **Logic Gaps**: Edge cases not covered, error scenarios missing, validation rules incomplete
3. ✨ **Best Practice Flaws**: Anti-patterns, testing strategy gaps, accessibility concerns
4. ⚡ **Performance Issues**: N+1 queries, missing caching, large data handling

**Scope**: ${scopeDescription}

**Architecture Context**:
${architecture || "(No architecture documented)"}

**Stories to Review**:
${storiesText}

**Output Format** (JSON):
{
  "summary": {
    "totalIssues": number,
    "highSeverity": number,
    "mediumSeverity": number,
    "lowSeverity": number,
    "recommendation": "string"
  },
  ${
    scope === "epic"
      ? `"storyFindings": [
    {
      "storyId": "string",
      "title": "string",
      "findings": {
        "security": [{ "id": "unique", "severity": "high|medium|low", "title": "...", "description": "...", "impact": "...", "suggestion": "..." }],
        "logic": [...],
        "bestPractices": [...],
        "performance": [...]
      }
    }
  ],
  "crossStoryIssues": [
    { "id": "unique", "category": "security|logic|bestPractices|performance", "severity": "high|medium|low", "title": "...", "description": "...", "affectedStories": ["2.1", "2.3"], "suggestion": "..." }
  ]`
      : `"findings": {
    "security": [{ "id": "unique", "severity": "high|medium|low", "title": "...", "description": "...", "impact": "...", "suggestion": "..." }],
    "logic": [...],
    "bestPractices": [...],
    "performance": [...]
  }`
  }
}

**Instructions**:
- Be thorough but practical
- Prioritize high-impact issues
- Provide actionable suggestions
- Flag missing requirements as logic gaps`;
}

interface OracleResult {
  success: boolean;
  content?: string;
  error?: string;
}

async function spawnOracleAndWait(
  ctx: PluginInput,
  config: AthenaConfig,
  prompt: string,
  _forceAdvancedModel?: boolean
): Promise<OracleResult> {
  try {
    const createResult = await ctx.client.session.create({
      body: {
        title: "Party Review - Oracle Analysis",
      },
    });

    if (!createResult.data?.id) {
      return { success: false, error: "Failed to create Oracle session" };
    }

    const sessionId = createResult.data.id;

    const promptResult = await ctx.client.session.prompt({
      path: { id: sessionId },
      body: {
        model: parseModelConfig(config.models.oracle),
        parts: [{ type: "text", text: prompt }],
      },
    });

    if (!promptResult.data) {
      return { success: false, error: "No response from Oracle" };
    }

    const messagesResult = await ctx.client.session.messages({
      path: { id: sessionId },
    });

    const lastMessage = messagesResult.data?.at(-1);
    if (!lastMessage) {
      return { success: false, error: "No messages in Oracle session" };
    }

    const textParts = lastMessage.parts?.filter((p) => p.type === "text") || [];
    const content = textParts.map((p) => (p as { text: string }).text).join("\n");

    return { success: true, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Oracle spawn failed: ${message}` };
  }
}

function parseModelConfig(modelString: string): { providerID: string; modelID: string } {
  const [providerID, modelID] = modelString.split("/");
  return { providerID: providerID || "openai", modelID: modelID || modelString };
}

async function saveReviewDocument(
  reviewsDir: string,
  scope: ReviewScope,
  identifier: string,
  stories: Array<{ id: string; content: string | null }>,
  parsed: ParsedOracleResponse,
  oracleAnalysis: string
): Promise<string> {
  const date = new Date().toISOString().split("T")[0];
  const filename = `party-review-${scope}-${identifier.replace(".", "-")}-${date}.md`;
  const filePath = join(reviewsDir, filename);

  const storyList = stories.map((s) => s.id).join(", ");
  const { summary } = parsed;

  const markdown = `# 🎉 Party Review: ${scope === "epic" ? `Epic ${identifier}` : `Story ${identifier}`}

**Date**: ${date}
**Reviewer**: Oracle (Party Mode)
**Stories Reviewed**: ${storyList}

---

## Executive Summary

- **Total Issues**: ${summary.totalIssues}
- **High Severity**: ${summary.highSeverity} issues (MUST address)
- **Medium Severity**: ${summary.mediumSeverity} issues (SHOULD address)
- **Low Severity**: ${summary.lowSeverity} issues (NICE to address)

**Recommendation**: ${summary.recommendation}

---

## Findings

${formatFindings(parsed)}

---

## Appendix: Oracle's Full Analysis

<details>
<summary>Click to expand detailed reasoning</summary>

${oracleAnalysis}

</details>
`;

  await writeFile(filePath, markdown, "utf-8");
  return filePath;
}

function formatFindings(parsed: ParsedOracleResponse): string {
  let output = "";

  const categoryIcons: Record<string, string> = {
    security: "🔒",
    logic: "🧠",
    bestPractices: "✨",
    performance: "⚡",
  };

  if (parsed.findings) {
    for (const [category, findings] of Object.entries(parsed.findings)) {
      if (findings && findings.length > 0) {
        output += `### ${categoryIcons[category] || ""} ${formatCategoryName(category)} (${findings.length} issues)\n\n`;
        for (const finding of findings) {
          output += `#### [${finding.severity.toUpperCase()}] ${finding.title}\n`;
          output += `**Finding**: ${finding.description}\n`;
          output += `**Impact**: ${finding.impact}\n`;
          output += `**Suggestion**: ${finding.suggestion}\n`;
          output += "**Decision**: [ ] Accept  [ ] Defer  [ ] Reject\n\n";
        }
      }
    }
  }

  if (parsed.storyFindings) {
    for (const story of parsed.storyFindings) {
      output += `### Story ${story.storyId}: ${story.title}\n\n`;
      for (const [category, findings] of Object.entries(story.findings)) {
        if (findings && findings.length > 0) {
          output += `#### ${categoryIcons[category] || ""} ${formatCategoryName(category)}\n\n`;
          for (const finding of findings) {
            output += `- [${finding.severity.toUpperCase()}] **${finding.title}**: ${finding.description}\n`;
          }
          output += "\n";
        }
      }
    }
  }

  if (parsed.crossStoryIssues && parsed.crossStoryIssues.length > 0) {
    output += "### Cross-Story Issues\n\n";
    for (const issue of parsed.crossStoryIssues) {
      output += `#### [${issue.severity.toUpperCase()}] ${issue.title}\n`;
      output += `**Stories Affected**: ${issue.affectedStories.join(", ")}\n`;
      output += `**Description**: ${issue.description}\n`;
      output += `**Suggestion**: ${issue.suggestion}\n\n`;
    }
  }

  return output || "No findings detected.";
}

function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    security: "Security Issues",
    logic: "Logic Issues",
    bestPractices: "Best Practices",
    performance: "Performance Issues",
  };
  return names[category] || category;
}

function buildSummary(findings: FindingCounts, agents: AgentRecommendation[]): string {
  const agentList = agents
    .filter((a) => a.priority !== "optional")
    .map((a) => a.agent)
    .join(", ");

  return `Found ${findings.total} issues (${findings.high} high, ${findings.medium} medium, ${findings.low} low). Recommended agents: ${agentList || "none"}.`;
}
