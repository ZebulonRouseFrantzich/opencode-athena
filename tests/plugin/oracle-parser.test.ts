import { describe, expect, it } from "vitest";
import {
  parseOracleResponse,
  countFindings,
  extractAllFindings,
  sortFindingsBySeverity,
} from "../../src/plugin/utils/oracle-parser.js";

describe("oracle-parser", () => {
  describe("parseOracleResponse", () => {
    describe("defensive null checks", () => {
      it("returns empty response for undefined input", () => {
        const result = parseOracleResponse(undefined as unknown as string);

        expect(result.summary.totalIssues).toBe(0);
        expect(result.summary.recommendation).toBe("No response provided");
      });

      it("returns empty response for null input", () => {
        const result = parseOracleResponse(null as unknown as string);

        expect(result.summary.totalIssues).toBe(0);
        expect(result.summary.recommendation).toBe("No response provided");
      });

      it("returns empty response for empty string", () => {
        const result = parseOracleResponse("");

        expect(result.summary.totalIssues).toBe(0);
        expect(result.summary.recommendation).toBe("No response provided");
      });

      it("returns empty response for non-string input", () => {
        const result = parseOracleResponse(123 as unknown as string);

        expect(result.summary.totalIssues).toBe(0);
        expect(result.summary.recommendation).toBe("No response provided");
      });
    });

    describe("JSON parsing", () => {
      it("returns empty response when no JSON found", () => {
        const result = parseOracleResponse("This is plain text without JSON");

        expect(result.summary.recommendation).toBe("No JSON found in Oracle response");
      });

      it("returns empty response for invalid JSON", () => {
        const result = parseOracleResponse("{ invalid json }");

        expect(result.summary.recommendation).toBe("Failed to parse Oracle response as JSON");
      });

      it("returns empty response when summary is missing", () => {
        const result = parseOracleResponse('{ "findings": {} }');

        expect(result.summary.recommendation).toBe("No summary in Oracle response");
      });

      it("parses valid Oracle response", () => {
        const validResponse = JSON.stringify({
          summary: {
            totalIssues: 5,
            highSeverity: 2,
            mediumSeverity: 2,
            lowSeverity: 1,
            recommendation: "Address high severity issues first",
          },
          findings: {
            security: [
              {
                id: "SEC-1",
                category: "security",
                severity: "high",
                title: "Missing auth",
                description: "No authentication",
                impact: "High",
                suggestion: "Add auth",
              },
            ],
            logic: [],
            bestPractices: [],
            performance: [],
          },
        });

        const result = parseOracleResponse(validResponse);

        expect(result.summary.totalIssues).toBe(5);
        expect(result.summary.highSeverity).toBe(2);
        expect(result.findings?.security).toHaveLength(1);
      });

      it("extracts JSON from text with surrounding content", () => {
        const responseWithWrapper = `
Here is my analysis:

{
  "summary": {
    "totalIssues": 1,
    "highSeverity": 0,
    "mediumSeverity": 1,
    "lowSeverity": 0,
    "recommendation": "Minor issues found"
  }
}

That concludes my review.
`;
        const result = parseOracleResponse(responseWithWrapper);

        expect(result.summary.totalIssues).toBe(1);
        expect(result.summary.recommendation).toBe("Minor issues found");
      });
    });
  });

  describe("countFindings", () => {
    it("counts findings from summary", () => {
      const parsed = {
        summary: {
          totalIssues: 10,
          highSeverity: 3,
          mediumSeverity: 5,
          lowSeverity: 2,
          recommendation: "Test",
        },
      };

      const counts = countFindings(parsed);

      expect(counts.total).toBe(10);
      expect(counts.high).toBe(3);
      expect(counts.medium).toBe(5);
      expect(counts.low).toBe(2);
    });

    it("counts by category from findings", () => {
      const parsed = {
        summary: {
          totalIssues: 4,
          highSeverity: 0,
          mediumSeverity: 0,
          lowSeverity: 0,
          recommendation: "Test",
        },
        findings: {
          security: [{ id: "1" }, { id: "2" }] as any[],
          logic: [{ id: "3" }] as any[],
          bestPractices: [] as any[],
          performance: [{ id: "4" }] as any[],
        },
      };

      const counts = countFindings(parsed);

      expect(counts.byCategory.security).toBe(2);
      expect(counts.byCategory.logic).toBe(1);
      expect(counts.byCategory.bestPractices).toBe(0);
      expect(counts.byCategory.performance).toBe(1);
    });
  });

  describe("extractAllFindings", () => {
    it("returns empty array for empty response", () => {
      const parsed = {
        summary: {
          totalIssues: 0,
          highSeverity: 0,
          mediumSeverity: 0,
          lowSeverity: 0,
          recommendation: "No issues",
        },
      };

      const findings = extractAllFindings(parsed);

      expect(findings).toHaveLength(0);
    });

    it("extracts findings from all categories", () => {
      const parsed = {
        summary: {
          totalIssues: 2,
          highSeverity: 1,
          mediumSeverity: 1,
          lowSeverity: 0,
          recommendation: "Test",
        },
        findings: {
          security: [
            {
              id: "SEC-1",
              category: "security" as const,
              severity: "high" as const,
              title: "Security issue",
              description: "Desc",
              impact: "High",
              suggestion: "Fix it",
            },
          ],
          logic: [
            {
              id: "LOG-1",
              category: "logic" as const,
              severity: "medium" as const,
              title: "Logic issue",
              description: "Desc",
              impact: "Medium",
              suggestion: "Fix it",
            },
          ],
          bestPractices: [],
          performance: [],
        },
      };

      const findings = extractAllFindings(parsed);

      expect(findings).toHaveLength(2);
      expect(findings[0].category).toBe("security");
      expect(findings[1].category).toBe("logic");
    });
  });

  describe("sortFindingsBySeverity", () => {
    it("sorts high before medium before low", () => {
      const findings = [
        { id: "1", severity: "low" as const, category: "logic" as const, title: "", description: "", impact: "", suggestion: "" },
        { id: "2", severity: "high" as const, category: "logic" as const, title: "", description: "", impact: "", suggestion: "" },
        { id: "3", severity: "medium" as const, category: "logic" as const, title: "", description: "", impact: "", suggestion: "" },
      ];

      const sorted = sortFindingsBySeverity(findings);

      expect(sorted[0].severity).toBe("high");
      expect(sorted[1].severity).toBe("medium");
      expect(sorted[2].severity).toBe("low");
    });
  });
});
