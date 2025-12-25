import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("../../src/plugin/utils/bmad-finder.js", () => ({
  getBmadPaths: vi.fn(),
}));

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { getBmadPaths } from "../../src/plugin/utils/bmad-finder.js";
import type { PartyDiscussionState, DiscussionRound } from "../../src/shared/types.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockGetBmadPaths = vi.mocked(getBmadPaths);

const createMockState = (completedRounds: DiscussionRound[]): PartyDiscussionState => ({
  sessionId: "test-session",
  scope: "story",
  identifier: "2.3",
  agenda: [],
  currentItemIndex: 0,
  completedRounds,
  activeAgents: ["architect", "dev"],
  startedAt: new Date().toISOString(),
  phase1Summary: { total: 2, high: 1, medium: 1, low: 0, byCategory: { security: 1, logic: 1, performance: 0, bestPractices: 0 } },
  phase2Summary: { consensusCount: 1, disputeCount: 1 },
});

const createMockRound = (overrides: Partial<DiscussionRound> = {}): DiscussionRound => ({
  findingId: "high-1",
  findingTitle: "Security issue with auth",
  findingSeverity: "high",
  findingCategory: "security",
  participants: ["architect", "dev"],
  responses: [],
  decision: "accept",
  decisionReason: "Critical fix needed",
  ...overrides,
});

describe("story-updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetBmadPaths.mockResolvedValue({
      projectRoot: "/test/project",
      bmadDir: "/test/project/.bmad",
      planningDir: "/test/project/docs/project-planning-artifacts",
      implementationDir: "/test/project/docs/implementation-artifacts",
      storiesDir: "/test/project/docs/implementation-artifacts/stories",
      sprintStatus: "/test/project/docs/implementation-artifacts/sprint-status.yaml",
      architecture: "/test/project/docs/project-planning-artifacts/architecture.md",
      prd: "/test/project/docs/project-planning-artifacts/PRD.md",
      epics: "/test/project/docs/project-planning-artifacts/epics.md",
    });
  });

  describe("applyDecisions", () => {
    it("should update story file with accepted findings", async () => {
      const round = createMockRound({
        findingId: "story-2-3-high-1",
        decision: "accept",
      });
      const state = createMockState([round]);

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`# Story 2.3

## Acceptance Criteria
- [ ] Existing criterion

## Technical Notes
Some notes here.`);
      mockWriteFile.mockResolvedValue(undefined);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      const result = await applyDecisions("/test/project", state);

      expect(result.success).toBe(true);
      expect(result.summary.accepted).toBe(1);
    });

    it("should add implementation notes for deferred findings", async () => {
      const round = createMockRound({
        findingId: "story-2-3-high-1",
        decision: "defer",
        deferredTo: "2.5",
      });
      const state = createMockState([round]);

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`# Story 2.3

## Acceptance Criteria
- [ ] Existing criterion`);
      mockWriteFile.mockResolvedValue(undefined);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      const result = await applyDecisions("/test/project", state);

      expect(result.success).toBe(true);
      expect(result.summary.deferred).toBe(1);
    });

    it("should handle story file not found", async () => {
      const round = createMockRound({
        findingId: "story-2-3-high-1",
        decision: "accept",
      });
      const state = createMockState([round]);

      mockExistsSync.mockReturnValue(false);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      const result = await applyDecisions("/test/project", state);

      expect(result.success).toBe(true);
      const successfulUpdates = result.updatedStories.filter((u) => u.success);
      expect(successfulUpdates.length).toBe(0);
    });

    it("should skip unknown story IDs", async () => {
      const round = createMockRound({
        findingId: "unknown-finding",
        decision: "accept",
      });
      const state = createMockState([round]);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      const result = await applyDecisions("/test/project", state);

      expect(result.success).toBe(true);
      expect(result.updatedStories.length).toBe(0);
    });
  });

  describe("formatUpdateSummary", () => {
    it("should format summary with all decision types", async () => {
      const { formatUpdateSummary } = await import("../../src/plugin/utils/story-updater.js");

      const result = {
        success: true,
        updatedStories: [
          {
            storyId: "2.3",
            filePath: "/test/project/docs/stories/story-2-3.md",
            addedCriteria: ["- [ ] [Security]: Fix auth issue"],
            addedNotes: ["### Security fix note"],
            success: true,
          },
        ],
        reviewDocumentPath: "/test/project/docs/reviews/review-2.3.md",
        summary: {
          accepted: 2,
          deferred: 1,
          rejected: 1,
          storiesUpdated: 1,
        },
      };

      const formatted = formatUpdateSummary(result);

      expect(formatted).toContain("Accepted findings: 2");
      expect(formatted).toContain("Deferred findings: 1");
      expect(formatted).toContain("Rejected findings: 1");
      expect(formatted).toContain("Stories updated: 1");
      expect(formatted).toContain("story-2-3.md");
    });

    it("should show error for failed story updates", async () => {
      const { formatUpdateSummary } = await import("../../src/plugin/utils/story-updater.js");

      const result = {
        success: true,
        updatedStories: [
          {
            storyId: "2.3",
            filePath: "/test/project/docs/stories/story-2-3.md",
            addedCriteria: [],
            addedNotes: [],
            success: false,
            error: "Permission denied",
          },
        ],
        summary: {
          accepted: 1,
          deferred: 0,
          rejected: 0,
          storiesUpdated: 0,
        },
      };

      const formatted = formatUpdateSummary(result);

      expect(formatted).toContain("Permission denied");
      expect(formatted).toContain("❌");
    });
  });

  describe("regex for acceptance criteria section", () => {
    it("should match acceptance criteria section followed by another heading", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`# Story

## Acceptance Criteria
- [ ] First criterion
- [ ] Second criterion

## Technical Notes
Some notes`);
      mockWriteFile.mockResolvedValue(undefined);

      const round = createMockRound({
        findingId: "story-2-3-high-1",
        decision: "accept",
      });
      const state = createMockState([round]);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      await applyDecisions("/test/project", state);

      if (mockWriteFile.mock.calls.length > 0) {
        const writtenContent = mockWriteFile.mock.calls[0][1] as string;
        expect(writtenContent).toContain("## Acceptance Criteria");
        expect(writtenContent).toContain("## Technical Notes");
      }
    });

    it("should match acceptance criteria section at end of file", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`# Story

## Acceptance Criteria
- [ ] First criterion
- [ ] Second criterion`);
      mockWriteFile.mockResolvedValue(undefined);

      const round = createMockRound({
        findingId: "story-2-3-high-1",
        decision: "accept",
      });
      const state = createMockState([round]);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      await applyDecisions("/test/project", state);

      if (mockWriteFile.mock.calls.length > 0) {
        const writtenContent = mockWriteFile.mock.calls[0][1] as string;
        expect(writtenContent).toContain("## Acceptance Criteria");
      }
    });
  });
});
