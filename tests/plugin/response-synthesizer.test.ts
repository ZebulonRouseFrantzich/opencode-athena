import { describe, expect, it } from "vitest";
import {
  parseAgentResponse,
  synthesizeAgentResponses,
} from "../../src/plugin/utils/response-synthesizer.js";

describe("response-synthesizer", () => {
  describe("parseAgentResponse", () => {
    describe("defensive null checks", () => {
      it("returns null for undefined input", () => {
        const result = parseAgentResponse(undefined as unknown as string);
        expect(result).toBeNull();
      });

      it("returns null for null input", () => {
        const result = parseAgentResponse(null as unknown as string);
        expect(result).toBeNull();
      });

      it("returns null for empty string", () => {
        const result = parseAgentResponse("");
        expect(result).toBeNull();
      });

      it("returns null for non-string input", () => {
        const result = parseAgentResponse(123 as unknown as string);
        expect(result).toBeNull();
      });
    });

    describe("JSON parsing", () => {
      it("returns null when no JSON found", () => {
        const result = parseAgentResponse("This is plain text without JSON");
        expect(result).toBeNull();
      });

      it("returns null for invalid JSON", () => {
        const result = parseAgentResponse("{ invalid json }");
        expect(result).toBeNull();
      });

      it("returns null when agent field is missing", () => {
        const result = parseAgentResponse('{ "findings": {} }');
        expect(result).toBeNull();
      });

      it("returns null when findings field is missing", () => {
        const result = parseAgentResponse('{ "agent": "dev" }');
        expect(result).toBeNull();
      });

      it("parses valid agent response", () => {
        const validResponse = JSON.stringify({
          agent: "architect",
          perspective: "Architecture perspective",
          findings: {
            agreements: ["I agree with X"],
            concerns: ["Y is concerning"],
            suggestions: ["Consider Z"],
          },
          crossStoryPatterns: [],
          prioritizedIssues: [],
          summary: "Overall assessment",
        });

        const result = parseAgentResponse(validResponse);

        expect(result).not.toBeNull();
        expect(result?.agent).toBe("architect");
        expect(result?.perspective).toBe("Architecture perspective");
        expect(result?.findings.agreements).toContain("I agree with X");
      });

      it("extracts JSON from text with surrounding content", () => {
        const responseWithWrapper = `
Here is my analysis as the architect:

{
  "agent": "architect",
  "perspective": "Architecture view",
  "findings": {
    "agreements": ["Good design"],
    "concerns": [],
    "suggestions": []
  },
  "crossStoryPatterns": [],
  "prioritizedIssues": [],
  "summary": "Looks good"
}

End of analysis.
`;
        const result = parseAgentResponse(responseWithWrapper);

        expect(result).not.toBeNull();
        expect(result?.agent).toBe("architect");
        expect(result?.summary).toBe("Looks good");
      });

      it("provides defaults for missing optional fields", () => {
        const minimalResponse = JSON.stringify({
          agent: "dev",
          findings: {
            agreements: [],
            concerns: [],
            suggestions: [],
          },
        });

        const result = parseAgentResponse(minimalResponse);

        expect(result).not.toBeNull();
        expect(result?.perspective).toBe("");
        expect(result?.crossStoryPatterns).toEqual([]);
        expect(result?.prioritizedIssues).toEqual([]);
        expect(result?.summary).toBe("");
      });
    });
  });

  describe("synthesizeAgentResponses", () => {
    it("handles empty analyses array", () => {
      const result = synthesizeAgentResponses([]);

      expect(result.agentAnalyses).toHaveLength(0);
      expect(result.consensusPoints).toHaveLength(0);
      expect(result.debatePoints).toHaveLength(0);
      expect(result.aggregatedPriorities).toHaveLength(0);
    });

    it("identifies consensus when multiple agents agree", () => {
      const analyses = [
        {
          agent: "architect" as const,
          perspective: "Architecture",
          findings: {
            agreements: [],
            concerns: ["Authentication is weak"],
            suggestions: [],
          },
          crossStoryPatterns: [],
          prioritizedIssues: [],
          summary: "",
        },
        {
          agent: "dev" as const,
          perspective: "Development",
          findings: {
            agreements: [],
            concerns: ["Authentication is weak"],
            suggestions: [],
          },
          crossStoryPatterns: [],
          prioritizedIssues: [],
          summary: "",
        },
      ];

      const result = synthesizeAgentResponses(analyses);

      expect(result.consensusPoints.length).toBeGreaterThan(0);
      expect(result.consensusPoints[0].agents).toContain("architect");
      expect(result.consensusPoints[0].agents).toContain("dev");
    });

    it("identifies debates when agents have conflicting priorities", () => {
      const analyses = [
        {
          agent: "architect" as const,
          perspective: "Architecture",
          findings: { agreements: [], concerns: [], suggestions: [] },
          crossStoryPatterns: [],
          prioritizedIssues: [
            { findingId: "SEC-1", agentPriority: "critical" as const, rationale: "Critical for security" },
          ],
          summary: "",
        },
        {
          agent: "dev" as const,
          perspective: "Development",
          findings: { agreements: [], concerns: [], suggestions: [] },
          crossStoryPatterns: [],
          prioritizedIssues: [
            { findingId: "SEC-1", agentPriority: "minor" as const, rationale: "Can be deferred" },
          ],
          summary: "",
        },
      ];

      const result = synthesizeAgentResponses(analyses);

      expect(result.debatePoints.length).toBeGreaterThan(0);
    });
  });
});
