import { randomUUID } from "node:crypto";
import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type {
  AgentDiscussionResponse,
  AthenaConfig,
  BmadAgentFullPersona,
  BmadAgentType,
  DiscussionAgendaItem,
  DiscussionRound,
  FindingCategory,
  FindingSeverity,
  PartyDiscussionResult,
  PartyDiscussionState,
  Phase1Result,
  Phase2Result,
  ReviewDecision,
} from "../../shared/types.js";
import { getPersona, loadPersonas, selectAgentsForFinding } from "../utils/persona-loader.js";

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 10;

interface SessionWithMeta {
  state: PartyDiscussionState;
  lastAccessedAt: number;
}

const activeSessions = new Map<string, SessionWithMeta>();

function cleanupStaleSessions(): void {
  const now = Date.now();
  const sessionsToDelete: string[] = [];

  for (const [id, session] of activeSessions) {
    if (now - session.lastAccessedAt > SESSION_TTL_MS) {
      sessionsToDelete.push(id);
    }
  }

  for (const id of sessionsToDelete) {
    activeSessions.delete(id);
  }

  if (activeSessions.size > MAX_SESSIONS) {
    const sortedSessions = Array.from(activeSessions.entries()).sort(
      (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt
    );

    const toRemove = sortedSessions.slice(0, activeSessions.size - MAX_SESSIONS);
    for (const [id] of toRemove) {
      activeSessions.delete(id);
    }
  }
}

function getSession(sessionId: string): PartyDiscussionState | null {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  session.lastAccessedAt = Date.now();
  return session.state;
}

function setSession(state: PartyDiscussionState): void {
  activeSessions.set(state.sessionId, {
    state,
    lastAccessedAt: Date.now(),
  });
}

function buildAgenda(phase1: Phase1Result, phase2?: Phase2Result): DiscussionAgendaItem[] {
  const agenda: DiscussionAgendaItem[] = [];

  const highSeverityFindings = extractHighSeverityFindings(phase1);
  for (const finding of highSeverityFindings) {
    const agentPositions = phase2 ? getAgentPositionsForFinding(finding.id, phase2) : {};
    agenda.push({
      id: `agenda-${finding.id}`,
      findingId: finding.id,
      topic: finding.title,
      type: "high-severity",
      severity: finding.severity,
      category: finding.category,
      relevantAgents: selectAgentsForFinding(finding.category, finding.severity),
      agentPositions,
      discussed: false,
    });
  }

  if (phase2) {
    for (const debate of phase2.debatePoints) {
      const existingItem = agenda.find((a) => a.topic === debate.topic);
      if (!existingItem) {
        const positions: Partial<Record<BmadAgentType, string>> = {};
        for (const pos of debate.positions) {
          positions[pos.agent] = pos.position;
        }
        agenda.push({
          id: `agenda-debate-${agenda.length}`,
          findingId: `debate-${agenda.length}`,
          topic: debate.topic,
          type: "disputed",
          severity: "medium",
          category: "logic",
          relevantAgents: debate.positions.map((p) => p.agent),
          agentPositions: positions,
          discussed: false,
        });
      }
    }
  }

  return agenda;
}

interface FindingInfo {
  id: string;
  title: string;
  severity: FindingSeverity;
  category: FindingCategory;
}

function extractHighSeverityFindings(phase1: Phase1Result): FindingInfo[] {
  const findings: FindingInfo[] = [];
  const analysis = phase1.oracleAnalysis;

  const highMatches = analysis.match(/\[HIGH\][^\n]+/gi) || [];
  for (let i = 0; i < highMatches.length; i++) {
    const match = highMatches[i];
    const title = match.replace(/\[HIGH\]\s*/i, "").trim();
    findings.push({
      id: `high-${i + 1}`,
      title,
      severity: "high",
      category: inferCategory(title),
    });
  }

  if (findings.length === 0 && phase1.findings.high > 0) {
    for (let i = 0; i < phase1.findings.high; i++) {
      findings.push({
        id: `high-${i + 1}`,
        title: `High severity finding ${i + 1}`,
        severity: "high",
        category: "logic",
      });
    }
  }

  return findings;
}

function inferCategory(title: string): FindingCategory {
  const lower = title.toLowerCase();
  if (lower.includes("security") || lower.includes("auth") || lower.includes("pii")) {
    return "security";
  }
  if (lower.includes("performance") || lower.includes("query") || lower.includes("cache")) {
    return "performance";
  }
  if (lower.includes("test") || lower.includes("pattern") || lower.includes("practice")) {
    return "bestPractices";
  }
  return "logic";
}

function getAgentPositionsForFinding(
  findingId: string,
  phase2: Phase2Result
): Partial<Record<BmadAgentType, string>> {
  const positions: Partial<Record<BmadAgentType, string>> = {};

  for (const analysis of phase2.agentAnalyses) {
    const prioritized = analysis.prioritizedIssues.find((p) =>
      p.findingId.toLowerCase().includes(findingId.toLowerCase())
    );
    if (prioritized) {
      positions[analysis.agent] = `${prioritized.agentPriority}: ${prioritized.rationale}`;
    } else if (analysis.findings.concerns.length > 0) {
      positions[analysis.agent] = analysis.findings.concerns[0];
    }
  }

  return positions;
}

function initializeSession(phase1: Phase1Result, phase2?: Phase2Result): PartyDiscussionState {
  const sessionId = randomUUID();
  const agenda = buildAgenda(phase1, phase2);

  const activeAgents = new Set<BmadAgentType>();
  for (const item of agenda) {
    for (const agent of item.relevantAgents) {
      activeAgents.add(agent);
    }
  }

  const state: PartyDiscussionState = {
    sessionId,
    scope: phase1.scope,
    identifier: phase1.identifier,
    agenda,
    currentItemIndex: 0,
    completedRounds: [],
    activeAgents: Array.from(activeAgents),
    startedAt: new Date().toISOString(),
    phase1Summary: phase1.findings,
    phase2Summary: phase2
      ? {
          consensusCount: phase2.consensusPoints.length,
          disputeCount: phase2.debatePoints.length,
        }
      : undefined,
  };

  setSession(state);
  return state;
}

async function generateAgentResponses(
  item: DiscussionAgendaItem,
  personas: Map<BmadAgentType, BmadAgentFullPersona>,
  phase2?: Phase2Result
): Promise<AgentDiscussionResponse[]> {
  const responses: AgentDiscussionResponse[] = [];

  for (const agentType of item.relevantAgents) {
    const persona = getPersona(personas, agentType);

    const phase2Analysis = phase2?.agentAnalyses.find((a) => a.agent === agentType);
    const previousPosition = item.agentPositions[agentType];

    const response = generateInCharacterResponse(
      persona,
      item,
      previousPosition,
      phase2Analysis?.summary,
      responses
    );

    responses.push({
      agent: agentType,
      agentName: persona.name,
      icon: persona.icon,
      response,
      references: extractReferences(response, responses),
      keyPoints: extractKeyPoints(response),
    });
  }

  return responses;
}

function generateInCharacterResponse(
  persona: BmadAgentFullPersona,
  item: DiscussionAgendaItem,
  previousPosition?: string,
  phase2Summary?: string,
  previousResponses?: AgentDiscussionResponse[]
): string {
  const intro = getResponseIntro(persona, item);
  const position = previousPosition || phase2Summary || getDefaultPosition(persona, item);
  const crossTalk = generateCrossTalk(persona, previousResponses);

  return `${intro} ${position}${crossTalk}`;
}

function getResponseIntro(persona: BmadAgentFullPersona, item: DiscussionAgendaItem): string {
  const intros: Record<BmadAgentType, string> = {
    architect: `From an architecture perspective on "${item.topic}":`,
    dev: `Looking at implementation for "${item.topic}":`,
    tea: `From a testing standpoint on "${item.topic}":`,
    pm: `Considering business impact of "${item.topic}":`,
    analyst: `Analyzing requirements around "${item.topic}":`,
    "ux-designer": `From a user experience view on "${item.topic}":`,
    "tech-writer": `Regarding documentation for "${item.topic}":`,
    sm: `From a process perspective on "${item.topic}":`,
  };

  return intros[persona.type] || `Regarding "${item.topic}":`;
}

function getDefaultPosition(_persona: BmadAgentFullPersona, item: DiscussionAgendaItem): string {
  if (item.severity === "high") {
    return `This is a ${item.severity} severity ${item.category} issue that needs attention before we proceed.`;
  }
  return `This ${item.category} concern should be addressed to maintain quality.`;
}

function generateCrossTalk(
  persona: BmadAgentFullPersona,
  previousResponses?: AgentDiscussionResponse[]
): string {
  if (!previousResponses || previousResponses.length === 0) return "";

  const collaborativeTypes: BmadAgentType[] = ["architect", "pm", "analyst"];
  const shouldCrossTalk =
    previousResponses.length >= 1 && collaborativeTypes.includes(persona.type);

  if (shouldCrossTalk) {
    const lastResponse = previousResponses[previousResponses.length - 1];
    return ` Building on ${lastResponse.agentName}'s point, I'd add that we should prioritize this appropriately.`;
  }
  return "";
}

function extractReferences(
  response: string,
  previousResponses: AgentDiscussionResponse[]
): AgentDiscussionResponse["references"] {
  const references: AgentDiscussionResponse["references"] = [];

  for (const prev of previousResponses) {
    if (response.includes(prev.agentName)) {
      const type = response.toLowerCase().includes("disagree")
        ? "disagrees"
        : response.toLowerCase().includes("building on")
          ? "builds-on"
          : "agrees";
      references.push({ agent: prev.agent, type });
    }
  }

  return references;
}

function extractKeyPoints(response: string): string[] {
  const sentences = response.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  return sentences.slice(0, 2).map((s) => s.trim());
}

function recordDecision(
  state: PartyDiscussionState,
  findingId: string,
  decision: ReviewDecision,
  reason?: string,
  deferredTo?: string
): PartyDiscussionState {
  const itemIndex = state.agenda.findIndex((a) => a.findingId === findingId);
  if (itemIndex === -1) return state;

  const item = state.agenda[itemIndex];
  item.discussed = true;

  const round: DiscussionRound = {
    findingId,
    findingTitle: item.topic,
    findingSeverity: item.severity,
    findingCategory: item.category,
    participants: item.relevantAgents,
    responses: [],
    decision,
    decisionReason: reason,
    deferredTo,
  };

  item.round = round;
  state.completedRounds.push(round);

  if (state.currentItemIndex === itemIndex) {
    state.currentItemIndex = findNextUndiscussedIndex(state);
  }

  return state;
}

function findNextUndiscussedIndex(state: PartyDiscussionState): number {
  for (let i = 0; i < state.agenda.length; i++) {
    if (!state.agenda[i].discussed) {
      return i;
    }
  }
  return state.agenda.length;
}

function calculateSummary(state: PartyDiscussionState): PartyDiscussionResult["summary"] {
  const decisions = { accepted: 0, deferred: 0, rejected: 0, pending: 0 };
  const storyUpdates = new Map<string, string[]>();

  for (const round of state.completedRounds) {
    switch (round.decision) {
      case "accept":
        decisions.accepted++;
        break;
      case "defer":
        decisions.deferred++;
        if (round.deferredTo) {
          const existing = storyUpdates.get(round.deferredTo) || [];
          existing.push(`Deferred: ${round.findingTitle}`);
          storyUpdates.set(round.deferredTo, existing);
        }
        break;
      case "reject":
        decisions.rejected++;
        break;
      default:
        decisions.pending++;
    }
  }

  for (const item of state.agenda) {
    if (!item.discussed) {
      decisions.pending++;
    }
  }

  return {
    totalDiscussed: state.completedRounds.length,
    decisions,
    storyUpdatesNeeded: Array.from(storyUpdates.entries()).map(([storyId, additions]) => ({
      storyId,
      additions,
    })),
  };
}

export function createPartyDiscussionTool(ctx: PluginInput, config: AthenaConfig): ToolDefinition {
  return tool({
    description: `Orchestrate Phase 3 party discussion for BMAD story review.

This tool manages an informed discussion where BMAD agents debate findings from Phase 1 (Oracle analysis) and optionally Phase 2 (parallel agent analysis).

Modes:
- Quick mode: Provide only phase1Result for rapid review of Oracle findings
- Full mode: Provide both phase1Result and phase2Result for in-depth discussion with agent perspectives

Actions:
- start: Initialize discussion with Phase 1 results (Phase 2 optional)
- continue: Get next agenda item and agent responses
- decide: Record user decision for a finding (accept/defer/reject)
- skip: Skip current finding without decision
- end: End discussion and get summary

The tool maintains session state across calls, enabling multi-turn discussion.`,

    args: {
      action: tool.schema
        .enum(["start", "continue", "decide", "skip", "end"])
        .describe("Action to perform"),
      sessionId: tool.schema
        .string()
        .optional()
        .describe("Session ID (required for continue/decide/skip/end)"),
      phase1Result: tool.schema
        .string()
        .optional()
        .describe("Phase 1 result JSON (required for start)"),
      phase2Result: tool.schema
        .string()
        .optional()
        .describe("Phase 2 result JSON (optional - omit for quick mode)"),
      findingId: tool.schema.string().optional().describe("Finding ID (required for decide)"),
      decision: tool.schema
        .enum(["accept", "defer", "reject"])
        .optional()
        .describe("Decision (required for decide)"),
      reason: tool.schema.string().optional().describe("Reason for decision"),
      deferredTo: tool.schema
        .string()
        .optional()
        .describe("Story ID to defer to (for defer decisions)"),
    },

    async execute(args): Promise<string> {
      const result = await executePartyDiscussion(ctx, config, args);
      return JSON.stringify(result, null, 2);
    },
  });
}

interface ToolArgs {
  action: "start" | "continue" | "decide" | "skip" | "end";
  sessionId?: string;
  phase1Result?: string;
  phase2Result?: string;
  findingId?: string;
  decision?: "accept" | "defer" | "reject";
  reason?: string;
  deferredTo?: string;
}

async function executePartyDiscussion(
  ctx: PluginInput,
  _config: AthenaConfig,
  args: ToolArgs
): Promise<PartyDiscussionResult> {
  cleanupStaleSessions();
  const personas = await loadPersonas(ctx.directory);

  switch (args.action) {
    case "start": {
      if (!args.phase1Result) {
        return {
          success: false,
          sessionId: "",
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "phase1Result is required for start action",
        };
      }

      let phase1: Phase1Result;
      let phase2: Phase2Result | undefined;
      try {
        phase1 = JSON.parse(args.phase1Result);
        phase2 = args.phase2Result ? JSON.parse(args.phase2Result) : undefined;
      } catch {
        return {
          success: false,
          sessionId: "",
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "Invalid JSON in phase1Result or phase2Result",
        };
      }

      const state = initializeSession(phase1, phase2);
      const currentItem = state.agenda[0];
      const responses = currentItem
        ? await generateAgentResponses(currentItem, personas, phase2)
        : undefined;

      return {
        success: true,
        sessionId: state.sessionId,
        state,
        currentItem,
        currentResponses: responses,
        hasMoreItems: state.agenda.length > 1,
      };
    }

    case "continue": {
      if (!args.sessionId) {
        return {
          success: false,
          sessionId: "",
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "sessionId is required for continue action",
        };
      }

      const state = getSession(args.sessionId);
      if (!state) {
        return {
          success: false,
          sessionId: args.sessionId,
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "Session not found",
        };
      }

      const currentItem = state.agenda[state.currentItemIndex];
      if (!currentItem || currentItem.discussed) {
        const nextIndex = findNextUndiscussedIndex(state);
        if (nextIndex >= state.agenda.length) {
          return {
            success: true,
            sessionId: state.sessionId,
            state,
            hasMoreItems: false,
            summary: calculateSummary(state),
          };
        }
        state.currentItemIndex = nextIndex;
      }

      const nextItem = state.agenda[state.currentItemIndex];
      const phase2Stub: Phase2Result = {
        success: true,
        identifier: state.identifier,
        agentAnalyses: [],
        consensusPoints: [],
        debatePoints: [],
        aggregatedPriorities: [],
      };

      const responses = await generateAgentResponses(nextItem, personas, phase2Stub);

      return {
        success: true,
        sessionId: state.sessionId,
        state,
        currentItem: nextItem,
        currentResponses: responses,
        hasMoreItems: state.currentItemIndex < state.agenda.length - 1,
      };
    }

    case "decide": {
      if (!args.sessionId || !args.findingId || !args.decision) {
        return {
          success: false,
          sessionId: args.sessionId || "",
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "sessionId, findingId, and decision are required for decide action",
        };
      }

      const state = getSession(args.sessionId);
      if (!state) {
        return {
          success: false,
          sessionId: args.sessionId,
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "Session not found",
        };
      }

      const updatedState = recordDecision(
        state,
        args.findingId,
        args.decision,
        args.reason,
        args.deferredTo
      );

      const hasMore = updatedState.currentItemIndex < updatedState.agenda.length;

      return {
        success: true,
        sessionId: updatedState.sessionId,
        state: updatedState,
        hasMoreItems: hasMore,
        summary: !hasMore ? calculateSummary(updatedState) : undefined,
      };
    }

    case "skip": {
      if (!args.sessionId || !args.findingId) {
        return {
          success: false,
          sessionId: args.sessionId || "",
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "sessionId and findingId are required for skip action",
        };
      }

      const state = getSession(args.sessionId);
      if (!state) {
        return {
          success: false,
          sessionId: args.sessionId,
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "Session not found",
        };
      }

      const itemIndex = state.agenda.findIndex((a) => a.findingId === args.findingId);
      if (itemIndex !== -1) {
        state.agenda[itemIndex].discussed = true;
        state.currentItemIndex = findNextUndiscussedIndex(state);
      }

      return {
        success: true,
        sessionId: state.sessionId,
        state,
        hasMoreItems: state.currentItemIndex < state.agenda.length,
      };
    }

    case "end": {
      if (!args.sessionId) {
        return {
          success: false,
          sessionId: "",
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "sessionId is required for end action",
        };
      }

      const state = getSession(args.sessionId);
      if (!state) {
        return {
          success: false,
          sessionId: args.sessionId,
          state: {} as PartyDiscussionState,
          hasMoreItems: false,
          error: "Session not found",
        };
      }

      activeSessions.delete(args.sessionId);

      return {
        success: true,
        sessionId: state.sessionId,
        state,
        hasMoreItems: false,
        summary: calculateSummary(state),
      };
    }

    default:
      return {
        success: false,
        sessionId: "",
        state: {} as PartyDiscussionState,
        hasMoreItems: false,
        error: `Unknown action: ${args.action}`,
      };
  }
}

export const _testExports = {
  buildAgenda,
  extractHighSeverityFindings,
  inferCategory,
  getAgentPositionsForFinding,
  initializeSession,
  generateAgentResponses,
  recordDecision,
  calculateSummary,
  activeSessions,
  cleanupStaleSessions,
  getSession,
  setSession,
  SESSION_TTL_MS,
  MAX_SESSIONS,
};
