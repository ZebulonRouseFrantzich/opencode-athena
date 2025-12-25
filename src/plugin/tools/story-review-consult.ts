import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type { AthenaConfig, BmadAgentType } from "../../shared/types.js";
import { getRecommendedAgentTypes } from "../utils/agent-selector.js";
import { getPersona, loadPersonas } from "../utils/persona-loader.js";
import {
  type AgentAnalysis,
  type SynthesizedResult,
  parseAgentResponse,
  synthesizeAgentResponses,
} from "../utils/response-synthesizer.js";
import type { Phase1AnalyzeResult } from "./story-review-analyze.js";

export interface Phase2ConsultResult {
  success: boolean;
  identifier: string;
  error?: string;
  suggestion?: string;

  agentAnalyses?: AgentAnalysis[];
  consensusPoints?: SynthesizedResult["consensusPoints"];
  debatePoints?: SynthesizedResult["debatePoints"];
  aggregatedPriorities?: SynthesizedResult["aggregatedPriorities"];
  summary?: string;
}

export function createStoryReviewConsultTool(
  ctx: PluginInput,
  config: AthenaConfig
): ToolDefinition {
  return tool({
    description: `Consult BMAD expert agents for their perspectives on review findings.

This tool performs Phase 2 of the party review workflow:
1. Spawns parallel sessions for each recommended BMAD agent
2. Each agent analyzes the findings from their expertise
3. Waits for all agents to complete (blocking)
4. Synthesizes responses to find consensus and debates
5. Returns aggregated priorities and positions

Use this after Phase 1 (athena_story_review_analyze) and before Phase 3 (athena_party_discussion).`,

    args: {
      phase1Result: tool.schema
        .string()
        .describe("JSON string from athena_story_review_analyze result"),
      agents: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Override agent list (default: use recommended from phase1)"),
    },

    async execute(args): Promise<string> {
      const result = await executePhase2Consultation(ctx, config, args.phase1Result, args.agents);
      return JSON.stringify(result, null, 2);
    },
  });
}

async function executePhase2Consultation(
  ctx: PluginInput,
  config: AthenaConfig,
  phase1Json: string,
  overrideAgents?: string[]
): Promise<Phase2ConsultResult> {
  let phase1: Phase1AnalyzeResult;
  try {
    phase1 = JSON.parse(phase1Json);
  } catch {
    return {
      success: false,
      identifier: "",
      error: "Invalid phase1Result JSON",
      suggestion: "Pass the raw JSON string from athena_story_review_analyze",
    };
  }

  if (!phase1.success || !phase1.oracleAnalysis) {
    return {
      success: false,
      identifier: phase1.identifier,
      error: "Phase 1 was not successful or missing oracle analysis",
      suggestion: "Run athena_story_review_analyze first",
    };
  }

  const agents = overrideAgents
    ? (overrideAgents as BmadAgentType[])
    : getRecommendedAgentTypes(phase1.recommendedAgents || []);

  if (agents.length === 0) {
    return {
      success: false,
      identifier: phase1.identifier,
      error: "No agents to consult",
      suggestion: "Specify agents or ensure Phase 1 has recommendations",
    };
  }

  const personas = await loadPersonas(ctx.directory);

  const agentPromises = agents.map((agentType) =>
    spawnAgentAndWait(ctx, config, agentType, phase1, personas)
  );

  const agentResults = await Promise.all(agentPromises);

  const successfulAnalyses = agentResults.filter((r) => r !== null) as AgentAnalysis[];

  if (successfulAnalyses.length === 0) {
    return {
      success: false,
      identifier: phase1.identifier,
      error: "All agent consultations failed",
      suggestion: "Check agent configuration and try again",
    };
  }

  const synthesized = synthesizeAgentResponses(successfulAnalyses);

  const summary = buildConsultationSummary(synthesized, agents.length);

  return {
    success: true,
    identifier: phase1.identifier,
    agentAnalyses: synthesized.agentAnalyses,
    consensusPoints: synthesized.consensusPoints,
    debatePoints: synthesized.debatePoints,
    aggregatedPriorities: synthesized.aggregatedPriorities,
    summary,
  };
}

async function spawnAgentAndWait(
  ctx: PluginInput,
  config: AthenaConfig,
  agentType: BmadAgentType,
  phase1: Phase1AnalyzeResult,
  personas: Map<BmadAgentType, import("../../shared/types.js").BmadAgentFullPersona>
): Promise<AgentAnalysis | null> {
  try {
    const persona = getPersona(personas, agentType);
    const prompt = buildAgentPrompt(persona, phase1);

    const createResult = await ctx.client.session.create({
      body: {
        title: `Party Review - ${persona.name} Analysis`,
      },
    });

    if (!createResult.data?.id) {
      console.warn(`[Athena] Failed to create session for ${agentType}`);
      return null;
    }

    const sessionId = createResult.data.id;

    await ctx.client.session.prompt({
      path: { id: sessionId },
      body: {
        model: parseModelConfig(config.models.sisyphus),
        parts: [{ type: "text", text: prompt }],
      },
    });

    const messagesResult = await ctx.client.session.messages({
      path: { id: sessionId },
    });

    const lastMessage = messagesResult.data?.at(-1);
    if (!lastMessage) {
      console.warn(`[Athena] No response from ${agentType}`);
      return null;
    }

    const textParts = lastMessage.parts?.filter((p) => p.type === "text") || [];
    const content = textParts.map((p) => (p as { text: string }).text).join("\n");

    const parsed = parseAgentResponse(content);
    if (!parsed) {
      return createFallbackAnalysis(agentType, persona.name, content);
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[Athena] Agent ${agentType} consultation failed: ${message}`);
    return null;
  }
}

function buildAgentPrompt(
  persona: import("../../shared/types.js").BmadAgentFullPersona,
  phase1: Phase1AnalyzeResult
): string {
  const storiesContext = phase1.storiesContent
    ?.map((s) => `Story ${s.id}:\n${s.content?.substring(0, 500) || "(empty)"}...`)
    .join("\n\n");

  return `You are ${persona.name}, the ${persona.title} from the BMAD team.

**Your Icon**: ${persona.icon}
**Your Expertise**: ${persona.expertise.join(", ")}
**Your Perspective**: ${persona.perspective}

**Your Task**: Analyze the following Oracle review findings from your ${persona.type} perspective.

**Stories Being Reviewed**:
${storiesContext || "(No story content available)"}

**Oracle's Findings**:
${phase1.oracleAnalysis?.substring(0, 3000) || "(No analysis available)"}

**Your Analysis Instructions**:
1. Review each finding from your ${persona.perspective} perspective
2. Note findings you agree with and why
3. Raise any concerns specific to your expertise
4. Suggest additional considerations
5. Prioritize issues based on ${persona.expertise[0] || "your expertise"} impact

**Return JSON** (MUST be valid JSON):
{
  "agent": "${persona.type}",
  "perspective": "${persona.perspective}",
  "findings": {
    "agreements": ["I agree with X because..."],
    "concerns": ["From my perspective, Y is concerning because..."],
    "suggestions": ["Consider also Z..."]
  },
  "crossStoryPatterns": [
    { "pattern": "...", "affectedStories": ["2.1"], "recommendation": "..." }
  ],
  "prioritizedIssues": [
    { "findingId": "...", "agentPriority": "critical|important|minor", "rationale": "..." }
  ],
  "summary": "Brief 2-3 sentence summary of my analysis"
}`;
}

function createFallbackAnalysis(
  agentType: BmadAgentType,
  agentName: string,
  rawContent: string
): AgentAnalysis {
  return {
    agent: agentType,
    perspective: `${agentName}'s perspective`,
    findings: {
      agreements: [],
      concerns: [rawContent.substring(0, 200)],
      suggestions: [],
    },
    crossStoryPatterns: [],
    prioritizedIssues: [],
    summary: `${agentName} provided analysis but response was not in expected JSON format.`,
  };
}

function parseModelConfig(modelString: string): { providerID: string; modelID: string } {
  const [providerID, modelID] = modelString.split("/");
  return { providerID: providerID || "anthropic", modelID: modelID || modelString };
}

function buildConsultationSummary(synthesized: SynthesizedResult, totalAgents: number): string {
  const successCount = synthesized.agentAnalyses.length;
  const consensusCount = synthesized.consensusPoints.length;
  const debateCount = synthesized.debatePoints.length;

  return `Consulted ${successCount}/${totalAgents} agents. Found ${consensusCount} consensus points and ${debateCount} debate points.`;
}
