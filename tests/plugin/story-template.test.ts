import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("../../src/plugin/utils/story-loader.js", () => ({
  findStoriesForEpic: vi.fn(),
}));

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { findStoriesForEpic } from "../../src/plugin/utils/story-loader.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockFindStoriesForEpic = vi.mocked(findStoriesForEpic);

describe("story-template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseDeferTarget", () => {
    it("should parse exact story ID with dot notation", async () => {
      const { parseDeferTarget } = await import("../../src/plugin/utils/story-template.js");

      const result = parseDeferTarget("4.5", "4", ["4.1", "4.2", "4.3"]);

      expect(result.type).toBe("exact");
      expect(result.storyId).toBe("4.5");
    });

    it("should parse exact story ID with dash notation", async () => {
      const { parseDeferTarget } = await import("../../src/plugin/utils/story-template.js");

      const result = parseDeferTarget("4-5", "4", ["4.1", "4.2", "4.3"]);

      expect(result.type).toBe("exact");
      expect(result.storyId).toBe("4.5");
    });

    it("should detect existing story for append", async () => {
      const { parseDeferTarget } = await import("../../src/plugin/utils/story-template.js");

      const result = parseDeferTarget("4.2", "4", ["4.1", "4.2", "4.3"]);

      expect(result.type).toBe("append-existing");
      expect(result.storyId).toBe("4.2");
    });

    it("should parse 'new story' to end of epic", async () => {
      const { parseDeferTarget } = await import("../../src/plugin/utils/story-template.js");

      const result = parseDeferTarget("new story", "4", ["4.1", "4.2", "4.3"]);

      expect(result.type).toBe("new-end");
      expect(result.storyId).toBe("4.4");
    });

    it("should parse 'new story after X' for sub-numbering", async () => {
      const { parseDeferTarget } = await import("../../src/plugin/utils/story-template.js");

      const result = parseDeferTarget("new story after 4.2", "4", ["4.1", "4.2", "4.3"]);

      expect(result.type).toBe("new-after");
      expect(result.storyId).toBe("4.2a");
      expect(result.referenceStoryId).toBe("4.2");
    });

    it("should parse 'new story before X' for sub-numbering", async () => {
      const { parseDeferTarget } = await import("../../src/plugin/utils/story-template.js");

      const result = parseDeferTarget("new story before 4.3", "4", ["4.1", "4.2", "4.3"]);

      expect(result.type).toBe("new-before");
      expect(result.storyId).toBe("4.2a");
      expect(result.referenceStoryId).toBe("4.3");
    });

    it("should handle 'next sprint' as new-end with warning potential", async () => {
      const { parseDeferTarget } = await import("../../src/plugin/utils/story-template.js");

      const result = parseDeferTarget("next sprint", "4", ["4.1", "4.2"]);

      expect(result.type).toBe("new-end");
      expect(result.storyId).toBe("4.3");
      expect(result.originalInput).toBe("next sprint");
    });

    it("should handle vague 'later' as new-end", async () => {
      const { parseDeferTarget } = await import("../../src/plugin/utils/story-template.js");

      const result = parseDeferTarget("later", "4", ["4.1"]);

      expect(result.type).toBe("new-end");
      expect(result.storyId).toBe("4.2");
    });
  });

  describe("getNextSubNumber", () => {
    it("should return 'a' suffix for first sub-number", async () => {
      const { getNextSubNumber } = await import("../../src/plugin/utils/story-template.js");

      const result = getNextSubNumber("4.2", ["4.1", "4.2", "4.3"]);

      expect(result).toBe("4.2a");
    });

    it("should return 'b' when 'a' exists", async () => {
      const { getNextSubNumber } = await import("../../src/plugin/utils/story-template.js");

      const result = getNextSubNumber("4.2", ["4.1", "4.2", "4.2a", "4.3"]);

      expect(result).toBe("4.2b");
    });

    it("should return 'c' when 'a' and 'b' exist", async () => {
      const { getNextSubNumber } = await import("../../src/plugin/utils/story-template.js");

      const result = getNextSubNumber("4.2", ["4.1", "4.2", "4.2a", "4.2b", "4.3"]);

      expect(result).toBe("4.2c");
    });
  });

  describe("getNextStoryNumber", () => {
    it("should return next number in epic", async () => {
      const { getNextStoryNumber } = await import("../../src/plugin/utils/story-template.js");

      const result = getNextStoryNumber("4", ["4.1", "4.2", "4.3"]);

      expect(result).toBe("4.4");
    });

    it("should handle empty epic", async () => {
      const { getNextStoryNumber } = await import("../../src/plugin/utils/story-template.js");

      const result = getNextStoryNumber("4", []);

      expect(result).toBe("4.1");
    });

    it("should handle sub-numbered stories correctly", async () => {
      const { getNextStoryNumber } = await import("../../src/plugin/utils/story-template.js");

      const result = getNextStoryNumber("4", ["4.1", "4.2", "4.2a", "4.2b", "4.3"]);

      expect(result).toBe("4.4");
    });

    it("should handle mixed epics", async () => {
      const { getNextStoryNumber } = await import("../../src/plugin/utils/story-template.js");

      const result = getNextStoryNumber("4", ["3.1", "3.2", "4.1", "4.2", "5.1"]);

      expect(result).toBe("4.3");
    });
  });

  describe("getExistingStoryIds", () => {
    it("should return story IDs for epic", async () => {
      mockFindStoriesForEpic.mockResolvedValue([
        { id: "4.1", epic: "4", number: "1", filename: "story-4-1.md", path: "/stories/story-4-1.md", hasStoryPrefix: true },
        { id: "4.2", epic: "4", number: "2", filename: "story-4-2.md", path: "/stories/story-4-2.md", hasStoryPrefix: true },
      ]);

      const { getExistingStoryIds } = await import("../../src/plugin/utils/story-template.js");

      const result = await getExistingStoryIds("/stories", "4");

      expect(result).toEqual(["4.1", "4.2"]);
    });
  });

  describe("loadTemplateFromExistingStory", () => {
    it("should load first story in epic as template", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue(["story-4-1.md", "story-4-2.md"] as never);
      mockReadFile.mockResolvedValue("# Story 4.1: Example\n\nStatus: done\n\n## Story\n...");

      const { loadTemplateFromExistingStory } = await import("../../src/plugin/utils/story-template.js");

      const result = await loadTemplateFromExistingStory("/stories", "4");

      expect(result).toContain("# Story 4.1");
      expect(mockReadFile).toHaveBeenCalled();
    });

    it("should return null when directory does not exist", async () => {
      mockExistsSync.mockReturnValue(false);

      const { loadTemplateFromExistingStory } = await import("../../src/plugin/utils/story-template.js");

      const result = await loadTemplateFromExistingStory("/stories", "4");

      expect(result).toBeNull();
    });

    it("should return null when no stories found", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue(["README.md"] as never);

      const { loadTemplateFromExistingStory } = await import("../../src/plugin/utils/story-template.js");

      const result = await loadTemplateFromExistingStory("/stories", "4");

      expect(result).toBeNull();
    });
  });

  describe("generateStoryContent", () => {
    it("should generate BMAD-compliant story content", async () => {
      const { generateStoryContent } = await import("../../src/plugin/utils/story-template.js");

      const context = {
        storyId: "4.5",
        epicNumber: "4",
        storyNumber: "5",
        title: "Deferred Security Findings",
        findings: [
          {
            id: "sec-1",
            title: "Missing input validation",
            category: "security" as const,
            severity: "high",
            reason: "Too complex for current sprint",
            originalStoryId: "4.2",
          },
        ],
        originalStoryId: "4.2",
        reviewDate: "2025-12-26",
        reviewDocumentPath: "/reviews/review.md",
      };

      const result = generateStoryContent(context);

      expect(result).toContain("# Story 4.5: Deferred Security Findings");
      expect(result).toContain("Status: backlog");
      expect(result).toContain("## Story");
      expect(result).toContain("## Acceptance Criteria");
      expect(result).toContain("[Security]: Missing input validation");
      expect(result).toContain("## Dev Notes");
      expect(result).toContain("deferred from the party review of Story 4.2");
      expect(result).toContain("## Dev Agent Record");
    });
  });

  describe("generateTitleFromFindings", () => {
    it("should use finding title for single finding", async () => {
      const { generateTitleFromFindings } = await import("../../src/plugin/utils/story-template.js");

      const findings = [
        { id: "1", title: "Fix auth bug", category: "security" as const, severity: "high", originalStoryId: "4.1" },
      ];

      const result = generateTitleFromFindings(findings);

      expect(result).toBe("Fix auth bug");
    });

    it("should generate category-based title for multiple same-category findings", async () => {
      const { generateTitleFromFindings } = await import("../../src/plugin/utils/story-template.js");

      const findings = [
        { id: "1", title: "Issue 1", category: "security" as const, severity: "high", originalStoryId: "4.1" },
        { id: "2", title: "Issue 2", category: "security" as const, severity: "medium", originalStoryId: "4.1" },
      ];

      const result = generateTitleFromFindings(findings);

      expect(result).toBe("Deferred Security Findings");
    });

    it("should generate generic title for mixed-category findings", async () => {
      const { generateTitleFromFindings } = await import("../../src/plugin/utils/story-template.js");

      const findings = [
        { id: "1", title: "Issue 1", category: "security" as const, severity: "high", originalStoryId: "4.1" },
        { id: "2", title: "Issue 2", category: "logic" as const, severity: "medium", originalStoryId: "4.1" },
      ];

      const result = generateTitleFromFindings(findings);

      expect(result).toBe("Deferred Findings from Party Review");
    });
  });

  describe("storyIdToFilename", () => {
    it("should convert story ID to filename", async () => {
      const { storyIdToFilename } = await import("../../src/plugin/utils/story-template.js");

      const result = storyIdToFilename("4.5");

      expect(result).toBe("story-4-5.md");
    });

    it("should include title in filename", async () => {
      const { storyIdToFilename } = await import("../../src/plugin/utils/story-template.js");

      const result = storyIdToFilename("4.5", "Fix Authentication Bug");

      expect(result).toBe("story-4-5-fix-authentication-bug.md");
    });

    it("should handle sub-numbered story IDs", async () => {
      const { storyIdToFilename } = await import("../../src/plugin/utils/story-template.js");

      const result = storyIdToFilename("4.2a", "Deferred Items");

      expect(result).toBe("story-4-2a-deferred-items.md");
    });

    it("should truncate long titles", async () => {
      const { storyIdToFilename } = await import("../../src/plugin/utils/story-template.js");

      const longTitle = "This is a very long title that should be truncated to fit file naming conventions";
      const result = storyIdToFilename("4.5", longTitle);

      expect(result.length).toBeLessThan(60);
      expect(result).toMatch(/^story-4-5-.+\.md$/);
    });
  });

  describe("roundsToFindings", () => {
    it("should convert discussion rounds to deferred findings", async () => {
      const { roundsToFindings } = await import("../../src/plugin/utils/story-template.js");

      const rounds = [
        {
          findingId: "high-1",
          findingTitle: "Security issue",
          findingCategory: "security" as const,
          findingSeverity: "high" as const,
          participants: ["architect" as const],
          responses: [],
          decision: "defer" as const,
          decisionReason: "Too complex",
        },
      ];

      const result = roundsToFindings(rounds, "4.2");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "high-1",
        title: "Security issue",
        category: "security",
        severity: "high",
        reason: "Too complex",
        originalStoryId: "4.2",
      });
    });
  });
});
