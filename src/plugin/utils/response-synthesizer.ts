import type { BmadAgentType } from "../../shared/types.js";

export interface AgentAnalysis {
  agent: BmadAgentType;
  perspective: string;
  findings: {
    agreements: string[];
    concerns: string[];
    suggestions: string[];
  };
  crossStoryPatterns: Array<{
    pattern: string;
    affectedStories: string[];
    recommendation: string;
  }>;
  prioritizedIssues: Array<{
    findingId: string;
    agentPriority: "critical" | "important" | "minor";
    rationale: string;
  }>;
  summary: string;
}

export interface ConsensusPoint {
  topic: string;
  agents: BmadAgentType[];
  position: string;
}

export interface DebatePoint {
  topic: string;
  positions: Array<{
    agent: BmadAgentType;
    position: string;
  }>;
}

export interface AggregatedPriority {
  findingId: string;
  votes: Partial<Record<BmadAgentType, "critical" | "important" | "minor">>;
  consensusLevel: "strong" | "moderate" | "disputed";
  averagePriority: "critical" | "important" | "minor";
}

export interface SynthesizedResult {
  agentAnalyses: AgentAnalysis[];
  consensusPoints: ConsensusPoint[];
  debatePoints: DebatePoint[];
  aggregatedPriorities: AggregatedPriority[];
}

export function synthesizeAgentResponses(analyses: AgentAnalysis[]): SynthesizedResult {
  const consensusPoints = findConsensusPoints(analyses);
  const debatePoints = findDebatePoints(analyses);
  const aggregatedPriorities = aggregatePriorities(analyses);

  return {
    agentAnalyses: analyses,
    consensusPoints,
    debatePoints,
    aggregatedPriorities,
  };
}

function calculateConsensusThreshold(totalAgents: number): number {
  const minimumAgents = 2;
  const proportionalThreshold = Math.ceil(totalAgents * 0.5);
  return Math.max(minimumAgents, proportionalThreshold);
}

function findConsensusPoints(analyses: AgentAnalysis[]): ConsensusPoint[] {
  const concernMap = new Map<string, { agents: BmadAgentType[]; positions: string[] }>();

  for (const analysis of analyses) {
    for (const concern of analysis.findings.concerns) {
      const key = normalizeForComparison(concern);
      const existing = concernMap.get(key) || { agents: [], positions: [] };
      existing.agents.push(analysis.agent);
      existing.positions.push(concern);
      concernMap.set(key, existing);
    }

    for (const agreement of analysis.findings.agreements) {
      const key = normalizeForComparison(agreement);
      const existing = concernMap.get(key) || { agents: [], positions: [] };
      existing.agents.push(analysis.agent);
      existing.positions.push(agreement);
      concernMap.set(key, existing);
    }
  }

  const consensusThreshold = calculateConsensusThreshold(analyses.length);
  const consensusPoints: ConsensusPoint[] = [];

  for (const [_, data] of concernMap) {
    if (data.agents.length >= consensusThreshold) {
      consensusPoints.push({
        topic: data.positions[0],
        agents: data.agents,
        position: data.positions[0],
      });
    }
  }

  return consensusPoints;
}

function findDebatePoints(analyses: AgentAnalysis[]): DebatePoint[] {
  const debatePoints: DebatePoint[] = [];
  const processedPairs = new Set<string>();

  for (let i = 0; i < analyses.length; i++) {
    for (let j = i + 1; j < analyses.length; j++) {
      const agent1 = analyses[i];
      const agent2 = analyses[j];
      const pairKey = `${agent1.agent}-${agent2.agent}`;

      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const conflictingPriorities = findConflictingPriorities(agent1, agent2);
      for (const conflict of conflictingPriorities) {
        debatePoints.push({
          topic: `Priority disagreement on ${conflict.findingId}`,
          positions: [
            { agent: agent1.agent, position: `${conflict.priority1}: ${conflict.rationale1}` },
            { agent: agent2.agent, position: `${conflict.priority2}: ${conflict.rationale2}` },
          ],
        });
      }
    }
  }

  return debatePoints;
}

interface PriorityConflict {
  findingId: string;
  priority1: string;
  rationale1: string;
  priority2: string;
  rationale2: string;
}

function findConflictingPriorities(
  agent1: AgentAnalysis,
  agent2: AgentAnalysis
): PriorityConflict[] {
  const conflicts: PriorityConflict[] = [];
  const priorityOrder = { critical: 0, important: 1, minor: 2 };

  for (const issue1 of agent1.prioritizedIssues) {
    const matchingIssue = agent2.prioritizedIssues.find((i) =>
      i.findingId.toLowerCase().includes(issue1.findingId.toLowerCase())
    );

    if (matchingIssue) {
      const diff = Math.abs(
        priorityOrder[issue1.agentPriority] - priorityOrder[matchingIssue.agentPriority]
      );
      if (diff >= 2) {
        conflicts.push({
          findingId: issue1.findingId,
          priority1: issue1.agentPriority,
          rationale1: issue1.rationale,
          priority2: matchingIssue.agentPriority,
          rationale2: matchingIssue.rationale,
        });
      }
    }
  }

  return conflicts;
}

function aggregatePriorities(analyses: AgentAnalysis[]): AggregatedPriority[] {
  const priorityMap = new Map<
    string,
    { votes: Partial<Record<BmadAgentType, "critical" | "important" | "minor">>; count: number }
  >();

  for (const analysis of analyses) {
    for (const issue of analysis.prioritizedIssues) {
      const existing = priorityMap.get(issue.findingId) || { votes: {}, count: 0 };
      existing.votes[analysis.agent] = issue.agentPriority;
      existing.count++;
      priorityMap.set(issue.findingId, existing);
    }
  }

  const aggregated: AggregatedPriority[] = [];
  for (const [findingId, data] of priorityMap) {
    const votes = Object.values(data.votes);
    const consensusLevel = calculateConsensusLevel(votes);
    const averagePriority = calculateAveragePriority(votes);

    aggregated.push({
      findingId,
      votes: data.votes,
      consensusLevel,
      averagePriority,
    });
  }

  return aggregated;
}

function calculateConsensusLevel(
  votes: Array<"critical" | "important" | "minor">
): "strong" | "moderate" | "disputed" {
  if (votes.length <= 1) return "strong";

  const uniqueVotes = new Set(votes);
  if (uniqueVotes.size === 1) return "strong";
  if (uniqueVotes.size === 2) return "moderate";
  return "disputed";
}

function calculateAveragePriority(
  votes: Array<"critical" | "important" | "minor">
): "critical" | "important" | "minor" {
  if (votes.length === 0) return "minor";

  const priorityOrder = { critical: 0, important: 1, minor: 2 };
  const sum = votes.reduce((acc, v) => acc + priorityOrder[v], 0);
  const avg = sum / votes.length;

  if (avg < 0.5) return "critical";
  if (avg < 1.5) return "important";
  return "minor";
}

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");
}

export function parseAgentResponse(responseText: string | null | undefined): AgentAnalysis | null {
  if (!responseText || typeof responseText !== "string") {
    return null;
  }

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as AgentAnalysis;

    if (!parsed.agent || !parsed.findings) return null;

    return {
      agent: parsed.agent,
      perspective: parsed.perspective || "",
      findings: {
        agreements: parsed.findings.agreements || [],
        concerns: parsed.findings.concerns || [],
        suggestions: parsed.findings.suggestions || [],
      },
      crossStoryPatterns: parsed.crossStoryPatterns || [],
      prioritizedIssues: parsed.prioritizedIssues || [],
      summary: parsed.summary || "",
    };
  } catch {
    return null;
  }
}
