import type { BmadAgentType, FindingCategory, FindingSeverity } from "../../shared/types.js";

export interface FindingCounts {
  total: number;
  high: number;
  medium: number;
  low: number;
  byCategory: Record<FindingCategory, number>;
}

export interface AgentRecommendation {
  agent: BmadAgentType;
  reason: string;
  relevantFindings: string[];
  priority: "required" | "recommended" | "optional";
}

const AGENT_EXPERTISE: Record<BmadAgentType, FindingCategory[]> = {
  architect: ["security", "performance"],
  dev: ["logic", "performance", "bestPractices"],
  tea: ["logic", "bestPractices"],
  pm: ["logic", "bestPractices"],
  analyst: ["logic"],
  "ux-designer": ["bestPractices"],
  "tech-writer": ["bestPractices"],
  sm: ["bestPractices"],
};

export function selectAgentsForFinding(
  category: FindingCategory,
  severity: FindingSeverity
): BmadAgentType[] {
  const agents: BmadAgentType[] = [];

  switch (category) {
    case "security":
      agents.push("architect", "dev", "tea");
      break;
    case "logic":
      agents.push("dev", "tea", "analyst");
      break;
    case "performance":
      agents.push("architect", "dev");
      break;
    case "bestPractices":
      agents.push("dev", "tech-writer");
      break;
    default:
      agents.push("dev", "architect");
  }

  if (severity === "high" && !agents.includes("pm")) {
    agents.push("pm");
  }

  return agents.slice(0, 4);
}

export function selectAgentsForReview(findings: FindingCounts): AgentRecommendation[] {
  const recommendations: AgentRecommendation[] = [];

  if (findings.byCategory.security > 0) {
    addSecurityAgents(recommendations, findings);
  }

  if (findings.byCategory.logic > 0) {
    addLogicAgents(recommendations, findings);
  }

  if (findings.byCategory.performance > 0) {
    addPerformanceAgents(recommendations);
  }

  if (findings.byCategory.bestPractices > 0) {
    addBestPracticesAgents(recommendations, findings);
  }

  if (findings.high > 0) {
    recommendations.push({
      agent: "pm",
      reason: `${findings.high} high severity issue(s) need product impact assessment`,
      relevantFindings: ["high-severity"],
      priority: "required",
    });
  }

  ensureAtLeastOneRequired(recommendations);

  return recommendations;
}

function addSecurityAgents(recommendations: AgentRecommendation[], findings: FindingCounts): void {
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

function addLogicAgents(recommendations: AgentRecommendation[], findings: FindingCounts): void {
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

function addPerformanceAgents(recommendations: AgentRecommendation[]): void {
  if (!recommendations.find((r) => r.agent === "architect")) {
    recommendations.push({
      agent: "architect",
      reason: "Performance issues need architecture review",
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

function addBestPracticesAgents(
  recommendations: AgentRecommendation[],
  findings: FindingCounts
): void {
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

function ensureAtLeastOneRequired(recommendations: AgentRecommendation[]): void {
  const requiredCount = recommendations.filter((r) => r.priority === "required").length;
  if (requiredCount === 0 && recommendations.length > 0) {
    recommendations[0].priority = "required";
  }
}

export function getRecommendedAgentTypes(recommendations: AgentRecommendation[]): BmadAgentType[] {
  const seen = new Set<BmadAgentType>();
  const agents: BmadAgentType[] = [];

  for (const rec of recommendations) {
    if (!seen.has(rec.agent)) {
      seen.add(rec.agent);
      agents.push(rec.agent);
    }
  }

  return agents;
}

export function filterByPriority(
  recommendations: AgentRecommendation[],
  minPriority: "required" | "recommended" | "optional"
): AgentRecommendation[] {
  const priorityOrder = { required: 0, recommended: 1, optional: 2 };
  const minLevel = priorityOrder[minPriority];

  return recommendations.filter((r) => priorityOrder[r.priority] <= minLevel);
}

export { AGENT_EXPERTISE };
