import type { FindingCategory, FindingSeverity } from "../../shared/types.js";
import type { FindingCounts } from "./agent-selector.js";

export interface FindingDetail {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  impact: string;
  suggestion: string;
}

export interface OracleResponseSummary {
  totalIssues: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  recommendation: string;
}

export interface OracleResponseFindings {
  security: FindingDetail[];
  logic: FindingDetail[];
  bestPractices: FindingDetail[];
  performance: FindingDetail[];
}

export interface StoryFinding {
  storyId: string;
  title: string;
  findings: Partial<OracleResponseFindings>;
}

export interface CrossStoryIssue {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  affectedStories: string[];
  suggestion: string;
}

export interface ParsedOracleResponse {
  summary: OracleResponseSummary;
  findings?: OracleResponseFindings;
  storyFindings?: StoryFinding[];
  crossStoryIssues?: CrossStoryIssue[];
}

export function parseOracleResponse(response: string | null | undefined): ParsedOracleResponse {
  if (!response || typeof response !== "string") {
    return createEmptyResponse("No response provided");
  }

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return createEmptyResponse("No JSON found in Oracle response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedOracleResponse;

    if (!parsed.summary) {
      return createEmptyResponse("No summary in Oracle response");
    }

    return parsed;
  } catch {
    return createEmptyResponse("Failed to parse Oracle response as JSON");
  }
}

function createEmptyResponse(reason: string): ParsedOracleResponse {
  return {
    summary: {
      totalIssues: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
      recommendation: reason,
    },
    findings: {
      security: [],
      logic: [],
      bestPractices: [],
      performance: [],
    },
  };
}

export function countFindings(parsed: ParsedOracleResponse): FindingCounts {
  const counts: FindingCounts = {
    total: parsed.summary.totalIssues,
    high: parsed.summary.highSeverity,
    medium: parsed.summary.mediumSeverity,
    low: parsed.summary.lowSeverity,
    byCategory: {
      security: 0,
      logic: 0,
      bestPractices: 0,
      performance: 0,
    },
  };

  if (parsed.findings) {
    counts.byCategory.security = parsed.findings.security?.length || 0;
    counts.byCategory.logic = parsed.findings.logic?.length || 0;
    counts.byCategory.bestPractices = parsed.findings.bestPractices?.length || 0;
    counts.byCategory.performance = parsed.findings.performance?.length || 0;
  }

  if (parsed.storyFindings) {
    for (const story of parsed.storyFindings) {
      counts.byCategory.security += story.findings.security?.length || 0;
      counts.byCategory.logic += story.findings.logic?.length || 0;
      counts.byCategory.bestPractices += story.findings.bestPractices?.length || 0;
      counts.byCategory.performance += story.findings.performance?.length || 0;
    }
  }

  return counts;
}

export function extractAllFindings(parsed: ParsedOracleResponse): FindingDetail[] {
  const allFindings: FindingDetail[] = [];

  if (parsed.findings) {
    for (const category of ["security", "logic", "bestPractices", "performance"] as const) {
      const findings = parsed.findings[category] || [];
      for (const finding of findings) {
        allFindings.push({ ...finding, category });
      }
    }
  }

  if (parsed.storyFindings) {
    for (const story of parsed.storyFindings) {
      for (const category of ["security", "logic", "bestPractices", "performance"] as const) {
        const findings = story.findings[category] || [];
        for (const finding of findings) {
          allFindings.push({ ...finding, category });
        }
      }
    }
  }

  return allFindings;
}

export function sortFindingsBySeverity(findings: FindingDetail[]): FindingDetail[] {
  const severityOrder: Record<FindingSeverity, number> = { high: 0, medium: 1, low: 2 };
  return [...findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
