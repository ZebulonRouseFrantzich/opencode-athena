import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type {
  AthenaConfig,
  CrossStoryIssue,
  FindingCategory,
  FindingSeverity,
  PartyReviewDocument,
  Phase1Context,
  ReviewDocumentReference,
  ReviewScope,
  StoryComplexity,
  StoryFindings,
} from "../../shared/types.js";
import { getBmadPaths } from "../utils/bmad-finder.js";
import {
  findStoriesForEpic as findStoriesForEpicShared,
  getStoryFilenamePatterns,
  loadStoryContent,
  normalizeStoryId as normalizeStoryIdShared,
} from "../utils/story-loader.js";

interface BmadPaths {
  projectRoot: string;
  bmadDir: string | null;
  planningDir: string;
  implementationDir: string;
  storiesDir: string;
  sprintStatus: string;
  architecture: string;
  prd: string;
  epics: string;
}

interface OracleResponseSummary {
  totalIssues: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  recommendation: string;
}

interface OracleResponseFindings {
  security: FindingDetail[];
  logic: FindingDetail[];
  bestPractices: FindingDetail[];
  performance: FindingDetail[];
}

interface ParsedOracleResponse {
  summary: OracleResponseSummary;
  findings?: OracleResponseFindings;
  storyFindings?: StoryFinding[];
  crossStoryIssues?: CrossStoryIssue[];
}

interface StoryFinding {
  storyId: string;
  title: string;
  findings: {
    security?: FindingDetail[];
    logic?: FindingDetail[];
    bestPractices?: FindingDetail[];
    performance?: FindingDetail[];
  };
}

interface FindingDetail {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  impact: string;
  suggestion: string;
}

export function createReviewStoryTool(ctx: PluginInput, config: AthenaConfig): ToolDefinition {
  return tool({
    description: `Run a party review on BMAD stories to find security, logic, best practice, and performance gaps.

This command generates a comprehensive review document BEFORE development starts, catching issues when they're cheap to fix (in markdown, not code).

The command is smart about argument types:
- Epic: "2", "epic-2" → Reviews all stories in the epic
- Story: "2.3", "story-2-3" → Deep dive on a single story  
- Path: "docs/stories/story-2-3.md" → Review specific file
- Flag: --thorough → Force advanced model (ignores complexity detection)

Returns:
- Review document path (saved to docs/reviews/)
- Structured findings by severity and category
- Recommendations for next steps

Use this tool after story creation but before development to improve story quality.`,

    args: {
      identifier: tool.schema
        .string()
        .describe("Epic number (e.g., '2'), Story ID (e.g., '2.3'), or file path. Required."),
      thorough: tool.schema
        .boolean()
        .optional()
        .describe("Force advanced model for review (default: auto-detect based on complexity)"),
    },

    async execute(args): Promise<string> {
      const result = await executePartyReview(ctx, config, args.identifier, args.thorough);
      return JSON.stringify(result, null, 2);
    },
  });
}

async function executePartyReview(
  ctx: PluginInput,
  config: AthenaConfig,
  identifier: string,
  forceAdvancedModel?: boolean
): Promise<Phase1Context> {
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

  await ensureReviewsDirectory(reviewsDir);

  if (scope === "epic") {
    return await executeEpicReview(ctx, config, paths, identifier, reviewsDir, forceAdvancedModel);
  }

  return await executeStoryReview(ctx, config, paths, identifier, reviewsDir, forceAdvancedModel);
}

function detectReviewScope(identifier: string): ReviewScope {
  const isFilePath = identifier.includes("/") || identifier.endsWith(".md");
  if (isFilePath) {
    return "story";
  }

  const cleanId = identifier.replace(/^(epic|story)-/, "");
  const isEpic = !cleanId.includes(".") && !cleanId.includes("-");

  return isEpic ? "epic" : "story";
}

async function ensureReviewsDirectory(reviewsDir: string): Promise<void> {
  if (!existsSync(reviewsDir)) {
    await mkdir(reviewsDir, { recursive: true });
  }
}

async function executeEpicReview(
  _ctx: PluginInput,
  config: AthenaConfig,
  paths: BmadPaths,
  identifier: string,
  reviewsDir: string,
  forceAdvancedModel?: boolean
): Promise<Phase1Context> {
  const epicNumber = identifier.replace(/^epic-/, "");

  const stories = await findStoriesInEpic(paths.storiesDir, epicNumber);
  if (stories.length === 0) {
    const patterns = getStoryFilenamePatterns(`${epicNumber}.1`);
    return {
      success: false,
      scope: "epic",
      identifier,
      error: `No stories found for Epic ${epicNumber}`,
      suggestion: `Check that story files exist in ${paths.storiesDir} matching: ${patterns.join(", ")}`,
    };
  }

  const storyContents = await Promise.all(
    stories.map(async (storyId) => ({
      id: storyId,
      content: await loadStoryFile(paths.storiesDir, storyId),
    }))
  );

  const architectureContent = await loadArchitecture(paths.architecture);

  const selectedModel = forceAdvancedModel ? config.models.oracle : config.models.oracle;

  const oraclePrompt = buildEpicReviewPrompt(epicNumber, storyContents, architectureContent);

  return {
    success: true,
    scope: "epic",
    identifier: epicNumber,
    oraclePrompt,
    storiesContent: storyContents,
    architectureContent,
    selectedModel,
    reviewsDir,
  };
}

async function executeStoryReview(
  _ctx: PluginInput,
  config: AthenaConfig,
  paths: BmadPaths,
  identifier: string,
  reviewsDir: string,
  forceAdvancedModel?: boolean
): Promise<Phase1Context> {
  const storyId = normalizeStoryId(identifier);

  const storyContent = await loadStoryFile(paths.storiesDir, storyId);
  if (!storyContent) {
    const patterns = getStoryFilenamePatterns(storyId);
    return {
      success: false,
      scope: "story",
      identifier: storyId,
      error: `Story ${storyId} not found`,
      suggestion: `Check that the story file exists in ${paths.storiesDir} matching: ${patterns.join(", ")}`,
    };
  }

  const existingReviews = await findExistingReviews(reviewsDir, storyId);
  const epicReview = existingReviews.find((r) => r.type === "epic");

  const architectureContent = await loadArchitecture(paths.architecture);

  const complexity = await analyzeStoryComplexity(storyContent);
  const selectedModel = forceAdvancedModel
    ? config.models.oracle
    : selectReviewModel(config, complexity);

  const oraclePrompt = buildFocusedReviewPrompt(
    storyId,
    storyContent,
    architectureContent,
    epicReview
  );

  return {
    success: true,
    scope: "story",
    identifier: storyId,
    oraclePrompt,
    storiesContent: [{ id: storyId, content: storyContent }],
    architectureContent,
    existingReviews,
    complexity,
    selectedModel,
    reviewsDir,
  };
}

async function findStoriesInEpic(storiesDir: string, epicNumber: string): Promise<string[]> {
  const stories = await findStoriesForEpicShared(storiesDir, epicNumber);
  return stories.map((s) => s.id);
}

async function loadStoryFile(storiesDir: string, storyId: string): Promise<string | null> {
  const result = await loadStoryContent(storiesDir, storyId);
  return result?.content ?? null;
}

async function loadArchitecture(architectureFile: string): Promise<string> {
  if (!existsSync(architectureFile)) {
    return "";
  }
  return await readFile(architectureFile, "utf-8");
}

function normalizeStoryId(identifier: string): string {
  return normalizeStoryIdShared(identifier);
}

async function findExistingReviews(
  reviewsDir: string,
  storyId: string
): Promise<ReviewDocumentReference[]> {
  if (!existsSync(reviewsDir)) {
    return [];
  }

  const files = await readdir(reviewsDir);

  const reviews: ReviewDocumentReference[] = [];
  const [epicNum] = storyId.split(".");

  for (const file of files) {
    if (file.startsWith(`party-review-epic-${epicNum}-`)) {
      const filePath = join(reviewsDir, file);
      const match = file.match(/(\d{4}-\d{2}-\d{2})/);

      reviews.push({
        type: "epic",
        filePath,
        date: match ? match[1] : "",
        findingsCount: 0,
        acceptedCount: 0,
        deferredCount: 0,
        rejectedCount: 0,
      });
    }
  }

  return reviews;
}

async function analyzeStoryComplexity(storyContent: string): Promise<StoryComplexity> {
  const acMatches = storyContent.match(/^- /gm) || [];
  const acceptanceCriteriaCount = acMatches.length;

  const securityKeywords = /\b(auth|login|password|token|secret|encrypt|permission|role|access)\b/i;
  const hasSecurityConcerns = securityKeywords.test(storyContent);

  const dataKeywords = /\b(database|schema|migration|model|table|collection)\b/i;
  const hasDataModelChanges = dataKeywords.test(storyContent);

  const apiKeywords = /\b(api|endpoint|route|controller|handler)\b/i;
  const hasApiChanges = apiKeywords.test(storyContent);

  const crudPattern = /\b(create|read|update|delete|get|post|put|patch|list)\b/gi;
  const crudMatches = storyContent.match(crudPattern) || [];
  const isCrudOnly = crudMatches.length > 0 && !hasSecurityConcerns && !hasDataModelChanges;

  const isSimple =
    acceptanceCriteriaCount < 5 && !hasSecurityConcerns && !hasDataModelChanges && isCrudOnly;

  return {
    isSimple,
    reason: isSimple
      ? `Simple story: ${acceptanceCriteriaCount} ACs, CRUD-only, no security/data concerns`
      : `Complex story: ${acceptanceCriteriaCount} ACs, security=${hasSecurityConcerns}, data=${hasDataModelChanges}, API=${hasApiChanges}`,
    recommendedModel: isSimple ? "anthropic/claude-3-5-haiku-20241022" : "openai/gpt-5.2",
    factors: {
      acceptanceCriteriaCount,
      hasSecurityConcerns,
      hasDataModelChanges,
      hasApiChanges,
      isCrudOnly,
    },
  };
}

function selectReviewModel(config: AthenaConfig, complexity: StoryComplexity): string {
  return complexity.isSimple ? "anthropic/claude-3-5-haiku-20241022" : config.models.oracle;
}

function buildEpicReviewPrompt(
  epicNumber: string,
  storyContents: Array<{ id: string; content: string | null }>,
  architectureContent: string
): string {
  const storiesText = storyContents
    .map((s) => `## Story ${s.id}\n\n${s.content || "(empty)"}`)
    .join("\n\n---\n\n");

  return `You are a security, logic, and performance expert conducting a "party review" of BMAD stories BEFORE development begins.

**Your Role**: Find issues while they're cheap to fix (in markdown, not code).

**Focus Areas**:
1. 🔒 **Security Gaps**: Missing auth/authorization, input validation, data exposure risks, credential handling
2. 🧠 **Logic Gaps**: Edge cases not covered, error scenarios missing, validation rules incomplete, race conditions
3. ✨ **Best Practice Flaws**: Anti-patterns in requirements, testing strategy gaps, accessibility concerns, unclear specifications
4. ⚡ **Performance Issues**: Potential N+1 queries, missing caching strategy, large data handling not addressed, client-side bundle concerns

**Scope**: Epic ${epicNumber} - Review ALL stories for issues AND cross-story patterns

**Architecture Context**:
${architectureContent || "(No architecture documented)"}

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
  "storyFindings": [
    {
      "storyId": "string",
      "title": "string",
      "findings": {
        "security": [
          {
            "id": "unique-id",
            "severity": "high" | "medium" | "low",
            "title": "Brief title",
            "description": "What's wrong",
            "impact": "Why it matters",
            "suggestion": "How to fix"
          }
        ],
        "logic": [...],
        "bestPractices": [...],
        "performance": [...]
      }
    }
  ],
  "crossStoryIssues": [
    {
      "id": "unique-id",
      "category": "security" | "logic" | "bestPractices" | "performance",
      "severity": "high" | "medium" | "low",
      "title": "Pattern or issue across multiple stories",
      "description": "Details",
      "affectedStories": ["2.1", "2.3"],
      "suggestion": "How to address"
    }
  ]
}

**Instructions**:
- Be thorough but practical
- Prioritize high-impact issues
- Provide actionable suggestions
- Consider the architecture constraints
- Flag missing requirements as logic gaps
- Look for inconsistencies across stories`;
}

function buildFocusedReviewPrompt(
  storyId: string,
  storyContent: string,
  architectureContent: string,
  epicReview?: ReviewDocumentReference
): string {
  const epicContext = epicReview
    ? `\n\n**Previous Epic Review**: An epic-level review was conducted on ${epicReview.date}. This focused review should find NEW issues not caught in the broader epic review.`
    : "";

  return `You are a security, logic, and performance expert conducting a DEEP DIVE "party review" of a single BMAD story BEFORE development begins.

**Your Role**: Find issues while they're cheap to fix (in markdown, not code). This is a FOCUSED review, so be more thorough than a broad epic review.

**Focus Areas**:
1. 🔒 **Security Gaps**: Missing auth/authorization, input validation, data exposure risks, credential handling, session management
2. 🧠 **Logic Gaps**: Edge cases not covered, error scenarios missing, validation rules incomplete, race conditions, state management
3. ✨ **Best Practice Flaws**: Anti-patterns in requirements, testing strategy gaps, accessibility concerns, unclear specifications, maintainability
4. ⚡ **Performance Issues**: Potential N+1 queries, missing caching strategy, large data handling, client-side bundle size, database indexes${epicContext}

**Story**: ${storyId}

**Architecture Context**:
${architectureContent || "(No architecture documented)"}

**Story Content**:
${storyContent}

**Output Format** (JSON):
{
  "summary": {
    "totalIssues": number,
    "highSeverity": number,
    "mediumSeverity": number,
    "lowSeverity": number,
    "recommendation": "string"
  },
  "findings": {
    "security": [
      {
        "id": "unique-id",
        "severity": "high" | "medium" | "low",
        "title": "Brief title",
        "description": "What's wrong",
        "impact": "Why it matters",
        "suggestion": "How to fix (be specific)"
      }
    ],
    "logic": [...],
    "bestPractices": [...],
    "performance": [...]
  }
}

**Instructions**:
- Be EXTREMELY thorough - this is a deep dive
- Think like an adversarial tester trying to break the implementation
- Question every assumption in the requirements
- Look for vague or incomplete acceptance criteria
- Consider security implications of every data flow
- Flag missing error handling scenarios
- Identify performance bottlenecks before they're coded
- Provide highly specific, actionable suggestions`;
}

function parseOracleResponse(_response: string, _scope: ReviewScope): ParsedOracleResponse {
  try {
    return JSON.parse(_response) as ParsedOracleResponse;
  } catch {
    return {
      summary: {
        totalIssues: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0,
        recommendation: "Failed to parse Oracle response",
      },
      findings: {
        security: [],
        logic: [],
        bestPractices: [],
        performance: [],
      },
    };
  }
}

function buildEpicReviewDocument(
  epicNumber: string,
  stories: string[],
  findings: ParsedOracleResponse,
  oracleAnalysis: string
): PartyReviewDocument {
  const timestamp = new Date().toISOString().split("T")[0];

  return {
    scope: "epic",
    identifier: epicNumber,
    date: timestamp,
    reviewer: "Oracle (Party Mode)",
    epicNumber,
    storiesReviewed: stories,
    summary: findings.summary,
    storyFindings: findings.storyFindings as unknown as StoryFindings[],
    crossStoryIssues: findings.crossStoryIssues,
    oracleAnalysis,
  };
}

function buildFocusedReviewDocument(
  storyId: string,
  findings: ParsedOracleResponse,
  epicReview: ReviewDocumentReference | undefined,
  oracleAnalysis: string
): PartyReviewDocument {
  const timestamp = new Date().toISOString().split("T")[0];
  const [epicNum] = storyId.split(".");

  return {
    scope: "story",
    identifier: storyId,
    date: timestamp,
    reviewer: "Oracle (Party Mode - Deep Dive)",
    epicNumber: epicNum,
    storyId,
    relatedReviews: epicReview ? [epicReview] : [],
    summary: findings.summary,
    newFindings: findings.findings,
    oracleAnalysis,
  };
}

async function saveReviewDocument(
  documentPath: string,
  document: PartyReviewDocument
): Promise<void> {
  const markdown = formatReviewDocumentAsMarkdown(document);
  await writeFile(documentPath, markdown, "utf-8");
}

function formatReviewDocumentAsMarkdown(doc: PartyReviewDocument): string {
  const title =
    doc.scope === "epic"
      ? `# 🎉 Party Review: Epic ${doc.epicNumber}\n`
      : `# 🎉 Party Review: Story ${doc.storyId} (Focused Review)\n`;

  const metadata = `**Date**: ${doc.date}
**Reviewer**: ${doc.reviewer}
${doc.scope === "epic" ? `**Stories Reviewed**: ${doc.storiesReviewed?.join(", ")}` : `**Epic**: ${doc.epicNumber}`}

---

## Executive Summary
- **Total Issues**: ${doc.summary.totalIssues}
- **High Severity**: ${doc.summary.highSeverity} issues (MUST address)
- **Medium Severity**: ${doc.summary.mediumSeverity} issues (SHOULD address)
- **Low Severity**: ${doc.summary.lowSeverity} issues (NICE to address)

**Recommendation**: ${doc.summary.recommendation}

---

`;

  const relatedReviews = doc.relatedReviews?.length
    ? `## 🔗 Related Reviews\n${doc.relatedReviews
        .map(
          (r) =>
            `- **${r.type === "epic" ? "Epic Review" : "Focused Review"}**: [${r.filePath.split("/").pop() ?? "review"}](${r.filePath}) (${r.date})`
        )
        .join("\n")}\n\n---\n\n`
    : "";

  const findingsSection =
    doc.scope === "epic" && doc.storyFindings
      ? formatEpicFindings(doc.storyFindings, doc.crossStoryIssues)
      : formatStoryFindings(doc.newFindings);

  const appendix = `\n---\n\n## Appendix: Oracle's Full Analysis\n<details>\n<summary>Click to expand detailed reasoning</summary>\n\n${doc.oracleAnalysis ?? ""}\n\n</details>\n`;

  return title + metadata + relatedReviews + findingsSection + appendix;
}

function formatEpicFindings(
  storyFindings: StoryFindings[],
  crossStoryIssues?: CrossStoryIssue[]
): string {
  let output = "";

  for (const story of storyFindings) {
    const typedStory = story as unknown as StoryFinding;
    output += `## Story ${typedStory.storyId}: ${typedStory.title}\n\n`;

    for (const category of ["security", "logic", "bestPractices", "performance"] as const) {
      const findings = (typedStory.findings[category] || []) as FindingDetail[];
      if (findings.length > 0) {
        const icon = getCategoryIcon(category);
        output += `### ${icon} ${formatCategoryName(category)} (${findings.length} issues)\n\n`;

        for (const finding of findings) {
          const severity = finding.severity.toUpperCase();
          output += `#### [${severity}] ${finding.title}\n`;
          output += `**Finding**: ${finding.description}\n`;
          output += `**Impact**: ${finding.impact}\n`;
          output += `**Suggestion**: ${finding.suggestion}\n`;
          output += "**Decision**: [ ] Accept  [ ] Defer  [ ] Reject\n\n";
        }
      }
    }

    output += "---\n\n";
  }

  if (crossStoryIssues && crossStoryIssues.length > 0) {
    output += "## Cross-Story Issues\n\n";
    for (const issue of crossStoryIssues) {
      const icon = getCategoryIcon(issue.category);
      output += `### ${icon} [${issue.severity.toUpperCase()}] ${issue.title}\n`;
      output += `**Stories Affected**: ${issue.affectedStories.join(", ")}\n`;
      output += `**Finding**: ${issue.description}\n`;
      output += `**Suggestion**: ${issue.suggestion}\n`;
      output += "**Decision**: [ ] Accept  [ ] Defer  [ ] Reject\n\n";
    }
  }

  return output;
}

function formatStoryFindings(findings: unknown): string {
  if (!findings) return "";

  const typedFindings = findings as OracleResponseFindings;
  let output = "";

  for (const category of ["security", "logic", "bestPractices", "performance"] as const) {
    const items = (typedFindings[category] || []) as FindingDetail[];
    if (items.length > 0) {
      const icon = getCategoryIcon(category);
      output += `## ${icon} ${formatCategoryName(category)} (${items.length} issues)\n\n`;

      for (const finding of items) {
        const severity = finding.severity.toUpperCase();
        output += `### [${severity}] ${finding.title}\n`;
        output += `**Finding**: ${finding.description}\n`;
        output += `**Impact**: ${finding.impact}\n`;
        output += `**Suggestion**: ${finding.suggestion}\n`;
        output += "**Decision**: [ ] Accept  [ ] Defer  [ ] Reject\n\n";
      }

      output += "---\n\n";
    }
  }

  return output;
}

function getCategoryIcon(category: FindingCategory): string {
  switch (category) {
    case "security":
      return "🔒";
    case "logic":
      return "🧠";
    case "bestPractices":
      return "✨";
    case "performance":
      return "⚡";
  }
}

function formatCategoryName(category: FindingCategory): string {
  switch (category) {
    case "security":
      return "Security Issues";
    case "logic":
      return "Logic Issues";
    case "bestPractices":
      return "Best Practices";
    case "performance":
      return "Performance Issues";
  }
}

async function updateEpicReviewDocument(
  _epicReviewPath: string,
  _storyId: string,
  _focusedReviewPath: string,
  _findings: ParsedOracleResponse
): Promise<void> {
  return;
}

// Export internal functions for testing
interface FindingCounts {
  total: number;
  high: number;
  medium: number;
  low: number;
  byCategory: Record<FindingCategory, number>;
}

interface AgentRecommendation {
  agent: string;
  reason: string;
  relevantFindings: string[];
  priority: "required" | "recommended" | "optional";
}

const _AGENT_EXPERTISE: Record<string, FindingCategory[]> = {
  architect: ["security", "performance"],
  dev: ["logic", "performance", "bestPractices"],
  tea: ["logic", "bestPractices"],
  pm: ["logic", "bestPractices"],
  analyst: ["logic"],
  "ux-designer": ["bestPractices"],
  "tech-writer": ["bestPractices"],
};

function selectAgentsForReview(findings: FindingCounts): AgentRecommendation[] {
  const recommendations: AgentRecommendation[] = [];

  if (findings.byCategory.security > 0) {
    recommendations.push({
      agent: "architect",
      reason: `${findings.byCategory.security} security finding(s) require architecture review`,
      relevantFindings: ["security"],
      priority: findings.high > 0 ? "required" : "recommended",
    });
    recommendations.push({
      agent: "dev",
      reason: "Security findings need implementation perspective",
      relevantFindings: ["security"],
      priority: "recommended",
    });
    recommendations.push({
      agent: "tea",
      reason: "Security findings need test coverage review",
      relevantFindings: ["security"],
      priority: "recommended",
    });
  }

  if (findings.byCategory.logic > 0) {
    if (!recommendations.find((r) => r.agent === "dev")) {
      recommendations.push({
        agent: "dev",
        reason: `${findings.byCategory.logic} logic gap(s) need implementation review`,
        relevantFindings: ["logic"],
        priority: findings.high > 0 ? "required" : "recommended",
      });
    }
    if (!recommendations.find((r) => r.agent === "tea")) {
      recommendations.push({
        agent: "tea",
        reason: "Logic gaps need test scenario review",
        relevantFindings: ["logic"],
        priority: "recommended",
      });
    }
    recommendations.push({
      agent: "analyst",
      reason: "Logic gaps may indicate incomplete requirements",
      relevantFindings: ["logic"],
      priority: "optional",
    });
  }

  if (findings.byCategory.performance > 0) {
    if (!recommendations.find((r) => r.agent === "architect")) {
      recommendations.push({
        agent: "architect",
        reason: `${findings.byCategory.performance} performance issue(s) need architecture review`,
        relevantFindings: ["performance"],
        priority: "recommended",
      });
    }
    if (!recommendations.find((r) => r.agent === "dev")) {
      recommendations.push({
        agent: "dev",
        reason: "Performance issues need implementation perspective",
        relevantFindings: ["performance"],
        priority: "recommended",
      });
    }
  }

  if (findings.byCategory.bestPractices > 0) {
    if (!recommendations.find((r) => r.agent === "dev")) {
      recommendations.push({
        agent: "dev",
        reason: `${findings.byCategory.bestPractices} best practice issue(s) need code review`,
        relevantFindings: ["bestPractices"],
        priority: "optional",
      });
    }
    recommendations.push({
      agent: "tech-writer",
      reason: "Best practice issues may need documentation updates",
      relevantFindings: ["bestPractices"],
      priority: "optional",
    });
  }

  if (findings.high > 0) {
    recommendations.push({
      agent: "pm",
      reason: `${findings.high} high severity issue(s) need product impact assessment`,
      relevantFindings: ["high-severity"],
      priority: "required",
    });
  }

  const requiredCount = recommendations.filter((r) => r.priority === "required").length;
  if (requiredCount === 0 && recommendations.length > 0) {
    recommendations[0].priority = "required";
  }

  return recommendations;
}

export const _testExports = {
  detectReviewScope,
  normalizeStoryId,
  analyzeStoryComplexity,
  selectReviewModel,
  findStoriesInEpic,
  loadStoryFile,
  findExistingReviews,
  parseOracleResponse,
  buildEpicReviewPrompt,
  buildFocusedReviewPrompt,
  buildEpicReviewDocument,
  buildFocusedReviewDocument,
  saveReviewDocument,
  formatReviewDocumentAsMarkdown,
  getCategoryIcon,
  formatCategoryName,
  updateEpicReviewDocument,
  selectAgentsForReview,
};
