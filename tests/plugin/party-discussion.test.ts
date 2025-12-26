import { describe, it, expect, beforeEach, vi } from "vitest";

const mockZodString = () => ({
  optional: () => ({ describe: () => ({}) }),
  describe: () => ({}),
});

const mockZodEnum = () => ({
  optional: () => ({ describe: () => ({}) }),
  describe: () => ({}),
});

const mockSchema = {
  string: mockZodString,
  enum: mockZodEnum,
};

vi.mock("@opencode-ai/plugin", () => {
  const toolFn = (config: any) => ({
    description: config.description,
    args: config.args,
    execute: config.execute,
  });
  toolFn.schema = mockSchema;
  return { tool: toolFn };
});

vi.mock("../../src/plugin/utils/persona-loader.js", () => ({
  loadPersonas: vi.fn(),
  getPersona: vi.fn(),
  selectAgentsForFinding: vi.fn(),
}));

import { loadPersonas, getPersona, selectAgentsForFinding } from "../../src/plugin/utils/persona-loader.js";
import { BMAD_AGENT_FULL_PERSONAS } from "../../src/shared/types.js";
import type { Phase1Result, Phase2Result, BmadAgentType, FindingCategory } from "../../src/shared/types.js";

const mockLoadPersonas = vi.mocked(loadPersonas);
const mockGetPersona = vi.mocked(getPersona);
const mockSelectAgentsForFinding = vi.mocked(selectAgentsForFinding);

const createMockOracleJson = () => JSON.stringify({
  summary: {
    totalIssues: 3,
    highSeverity: 2,
    mediumSeverity: 1,
    lowSeverity: 0,
    recommendation: "Address security issues before proceeding",
  },
  storyFindings: [
    {
      storyId: "2.3",
      title: "Widget Configuration",
      findings: {
        security: [
          {
            id: "S2.3-SEC-1",
            severity: "high",
            title: "Missing input validation on configuration endpoint",
            description: "The endpoint accepts configuration without proper validation",
            impact: "Could lead to injection attacks",
            suggestion: "Add schema validation",
          },
        ],
        logic: [
          {
            id: "S2.3-LOG-1",
            severity: "high",
            title: "Race condition in concurrent updates",
            description: "Multiple users updating simultaneously may cause data loss",
            impact: "Data integrity issues",
            suggestion: "Implement optimistic locking",
          },
        ],
        bestPractices: [],
        performance: [],
      },
    },
  ],
});

const createMockPhase1 = (): Phase1Result => ({
  success: true,
  scope: "story",
  identifier: "2.3",
  reviewDocPath: "/path/to/review.md",
  storiesContent: [{ id: "2.3", title: "Test Story", content: "Story content" }],
  architectureContent: "Architecture content",
  oracleAnalysis: createMockOracleJson(),
  findings: {
    total: 3,
    high: 2,
    medium: 1,
    low: 0,
    byCategory: {
      security: 1,
      logic: 1,
      performance: 0,
      bestPractices: 1,
    } as Record<FindingCategory, number>,
  },
  recommendedAgents: [
    { agent: "architect", reason: "Security concerns", relevantFindings: ["high-1"], priority: "required" },
    { agent: "dev", reason: "Implementation review", relevantFindings: ["high-2"], priority: "recommended" },
  ],
});

const createMockPhase2 = (): Phase2Result => ({
  success: true,
  identifier: "2.3",
  agentAnalyses: [
    {
      agent: "architect" as BmadAgentType,
      agentName: "Winston",
      analyzedAt: new Date().toISOString(),
      storiesAnalyzed: ["2.3"],
      perspective: "architecture",
      findings: { agreements: [], concerns: ["Concern 1"], suggestions: [] },
      crossStoryPatterns: [],
      prioritizedIssues: [
        { findingId: "high-1", agentPriority: "critical", rationale: "Security risk" },
      ],
      summary: "Architect summary",
    },
  ],
  consensusPoints: ["Auth approach agreed"],
  debatePoints: [
    {
      topic: "Caching strategy",
      positions: [
        { agent: "architect" as BmadAgentType, position: "Use Redis" },
        { agent: "dev" as BmadAgentType, position: "Use in-memory" },
      ],
    },
  ],
  aggregatedPriorities: [],
});

describe("party-discussion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    const mockPersonas = new Map(
      Object.entries(BMAD_AGENT_FULL_PERSONAS) as [BmadAgentType, typeof BMAD_AGENT_FULL_PERSONAS.architect][]
    );
    mockLoadPersonas.mockResolvedValue(mockPersonas);
    mockGetPersona.mockImplementation((_personas, type) => BMAD_AGENT_FULL_PERSONAS[type]);
    mockSelectAgentsForFinding.mockReturnValue(["architect", "dev", "tea"]);
  });

  describe("buildAgenda", () => {
    it("should create agenda items for high severity findings", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1 = createMockPhase1();
      const phase2 = createMockPhase2();

      const agenda = _testExports.buildAgenda(phase1, phase2);

      expect(agenda.length).toBeGreaterThan(0);
      expect(agenda.some((item) => item.type === "high-severity")).toBe(true);
    });

    it("should include debate points in agenda", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1 = createMockPhase1();
      const phase2 = createMockPhase2();

      const agenda = _testExports.buildAgenda(phase1, phase2);

      expect(agenda.some((item) => item.type === "disputed")).toBe(true);
      expect(agenda.some((item) => item.topic === "Caching strategy")).toBe(true);
    });
  });

  describe("extractHighSeverityFindings", () => {
    it("should extract findings from Oracle JSON response", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1 = createMockPhase1();

      const findings = _testExports.extractHighSeverityFindings(phase1);

      expect(findings.length).toBe(2);
      expect(findings[0].severity).toBe("high");
      expect(findings[0].title).toContain("Missing input validation");
    });

    it("should handle missing oracleAnalysis gracefully", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1: Phase1Result = {
        ...createMockPhase1(),
        oracleAnalysis: undefined,
      };

      const findings = _testExports.extractHighSeverityFindings(phase1);

      expect(findings.length).toBe(2);
      expect(findings[0].title).toContain("High severity finding");
      expect(findings[0].severity).toBe("high");
    });

    it("should handle null oracleAnalysis", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1 = {
        ...createMockPhase1(),
        oracleAnalysis: null,
      } as unknown as Phase1Result;

      const findings = _testExports.extractHighSeverityFindings(phase1);

      expect(findings.length).toBe(2);
      expect(findings[0].title).toContain("High severity finding");
    });

    it("should handle empty oracleAnalysis string", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1: Phase1Result = {
        ...createMockPhase1(),
        oracleAnalysis: "",
      };

      const findings = _testExports.extractHighSeverityFindings(phase1);

      expect(findings.length).toBe(2);
      expect(findings[0].title).toContain("High severity finding");
    });

    it("should handle invalid JSON in oracleAnalysis", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1: Phase1Result = {
        ...createMockPhase1(),
        oracleAnalysis: "This is not valid JSON {broken",
      };

      const findings = _testExports.extractHighSeverityFindings(phase1);

      expect(findings.length).toBe(2);
      expect(findings[0].title).toContain("High severity finding");
    });

    it("should handle missing findings count with placeholder", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1: Phase1Result = {
        success: true,
        scope: "story",
        identifier: "2.3",
        findings: {
          total: 2,
          high: 2,
          medium: 0,
          low: 0,
          byCategory: { security: 0, logic: 2, performance: 0, bestPractices: 0 },
        },
      };

      const findings = _testExports.extractHighSeverityFindings(phase1);

      expect(findings.length).toBe(2);
      expect(findings[0].title).toContain("High severity finding 1");
    });

    it("should return empty array when no high findings and no oracleAnalysis", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1: Phase1Result = {
        success: true,
        scope: "story",
        identifier: "2.3",
        findings: {
          total: 1,
          high: 0,
          medium: 1,
          low: 0,
          byCategory: { security: 0, logic: 1, performance: 0, bestPractices: 0 },
        },
      };

      const findings = _testExports.extractHighSeverityFindings(phase1);

      expect(findings.length).toBe(0);
    });
  });

  describe("inferCategory", () => {
    it("should infer security category", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");

      expect(_testExports.inferCategory("Missing authentication check")).toBe("security");
      expect(_testExports.inferCategory("PII data exposure")).toBe("security");
    });

    it("should infer performance category", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");

      expect(_testExports.inferCategory("N+1 query issue")).toBe("performance");
      expect(_testExports.inferCategory("Missing cache invalidation")).toBe("performance");
    });

    it("should default to logic category", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");

      expect(_testExports.inferCategory("Generic issue")).toBe("logic");
    });
  });

  describe("session management", () => {
    it("should initialize session with correct state", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1 = createMockPhase1();
      const phase2 = createMockPhase2();

      const state = _testExports.initializeSession(phase1, phase2);

      expect(state.sessionId).toBeDefined();
      expect(state.scope).toBe("story");
      expect(state.identifier).toBe("2.3");
      expect(state.agenda.length).toBeGreaterThan(0);
      expect(state.currentItemIndex).toBe(0);
      expect(state.completedRounds).toEqual([]);
    });

    it("should store session in activeSessions map", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1 = createMockPhase1();
      const phase2 = createMockPhase2();

      const state = _testExports.initializeSession(phase1, phase2);

      const retrieved = _testExports.getSession(state.sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(state.sessionId);
    });
  });

  describe("session cleanup", () => {
    it("should clean up stale sessions", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");

      _testExports.activeSessions.clear();

      const oldSession = {
        state: { sessionId: "old-session" } as any,
        lastAccessedAt: Date.now() - (_testExports.SESSION_TTL_MS + 1000),
      };
      _testExports.activeSessions.set("old-session", oldSession);

      const newSession = {
        state: { sessionId: "new-session" } as any,
        lastAccessedAt: Date.now(),
      };
      _testExports.activeSessions.set("new-session", newSession);

      _testExports.cleanupStaleSessions();

      expect(_testExports.activeSessions.has("old-session")).toBe(false);
      expect(_testExports.activeSessions.has("new-session")).toBe(true);
    });

    it("should enforce max sessions limit", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");

      _testExports.activeSessions.clear();

      for (let i = 0; i < _testExports.MAX_SESSIONS + 5; i++) {
        _testExports.activeSessions.set(`session-${i}`, {
          state: { sessionId: `session-${i}` } as any,
          lastAccessedAt: Date.now() + i,
        });
      }

      _testExports.cleanupStaleSessions();

      expect(_testExports.activeSessions.size).toBeLessThanOrEqual(_testExports.MAX_SESSIONS);
    });
  });

  describe("recordDecision", () => {
    it("should record accept decision", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1 = createMockPhase1();
      const phase2 = createMockPhase2();

      const state = _testExports.initializeSession(phase1, phase2);
      const findingId = state.agenda[0].findingId;

      const updated = _testExports.recordDecision(state, findingId, "accept", "Good finding");

      expect(updated.completedRounds.length).toBe(1);
      expect(updated.completedRounds[0].decision).toBe("accept");
      expect(updated.completedRounds[0].decisionReason).toBe("Good finding");
    });

    it("should record defer decision with target story", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1 = createMockPhase1();
      const phase2 = createMockPhase2();

      const state = _testExports.initializeSession(phase1, phase2);
      const findingId = state.agenda[0].findingId;

      const updated = _testExports.recordDecision(state, findingId, "defer", "Later", "2.5");

      expect(updated.completedRounds[0].decision).toBe("defer");
      expect(updated.completedRounds[0].deferredTo).toBe("2.5");
    });
  });

  describe("calculateSummary", () => {
    it("should calculate decision counts correctly", async () => {
      const { _testExports } = await import("../../src/plugin/tools/party-discussion.js");
      const phase1 = createMockPhase1();
      const phase2 = createMockPhase2();

      const state = _testExports.initializeSession(phase1, phase2);

      if (state.agenda.length >= 2) {
        _testExports.recordDecision(state, state.agenda[0].findingId, "accept");
        _testExports.recordDecision(state, state.agenda[1].findingId, "reject");
      }

      const summary = _testExports.calculateSummary(state);

      expect(summary).toBeDefined();
      expect(summary!.totalDiscussed).toBe(Math.min(2, state.agenda.length));
      expect(
        summary!.decisions.accepted + summary!.decisions.rejected + summary!.decisions.pending
      ).toBeGreaterThan(0);
    });
  });
});
