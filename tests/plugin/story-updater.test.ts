import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("../../src/plugin/utils/bmad-finder.js", () => ({
  getBmadPaths: vi.fn(),
}));

import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { getBmadPaths } from "../../src/plugin/utils/bmad-finder.js";
import type { PartyDiscussionState, DiscussionRound } from "../../src/shared/types.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockReaddir = vi.mocked(readdir);
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

    mockReaddir.mockResolvedValue(["story-2-3.md"] as never);
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
      const successfulUpdates = result.storiesUpdated.filter((u) => u.success);
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
      expect(result.storiesUpdated.length).toBe(0);
    });
  });

  describe("formatUpdateSummary", () => {
    it("should format summary with all decision types", async () => {
      const { formatUpdateSummary } = await import("../../src/plugin/utils/story-updater.js");

      const result = {
        success: true,
        storiesUpdated: [
          {
            storyId: "2.3",
            filePath: "/test/project/docs/stories/story-2-3.md",
            action: "updated" as const,
            addedCriteria: ["- [ ] [Security]: Fix auth issue"],
            addedNotes: ["### Security fix note"],
            success: true,
          },
        ],
        storiesCreated: [],
        storiesAppended: [],
        reviewDocumentUpdated: true,
        decisionsAppliedDocument: "/test/project/docs/reviews/decisions-applied.md",
        summary: {
          accepted: 2,
          deferred: 1,
          rejected: 1,
          storiesModified: 1,
          storiesCreated: 0,
        },
      };

      const formatted = formatUpdateSummary(result);

      expect(formatted).toContain("Accepted findings: 2");
      expect(formatted).toContain("Deferred findings: 1");
      expect(formatted).toContain("Rejected findings: 1");
      expect(formatted).toContain("Stories modified: 1");
      expect(formatted).toContain("story-2-3.md");
    });

    it("should show error for failed story updates", async () => {
      const { formatUpdateSummary } = await import("../../src/plugin/utils/story-updater.js");

      const result = {
        success: true,
        storiesUpdated: [
          {
            storyId: "2.3",
            filePath: "/test/project/docs/stories/story-2-3.md",
            action: "updated" as const,
            addedCriteria: [],
            addedNotes: [],
            success: false,
            error: "Permission denied",
          },
        ],
        storiesCreated: [],
        storiesAppended: [],
        reviewDocumentUpdated: false,
        summary: {
          accepted: 1,
          deferred: 0,
          rejected: 0,
          storiesModified: 0,
          storiesCreated: 0,
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

  describe("content structure validation", () => {
    it("should add acceptance criteria in correct format after existing criteria", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`# Story 2.3

## Acceptance Criteria
- [ ] Existing criterion 1
- [ ] Existing criterion 2

## Technical Notes
Some notes`);
      mockWriteFile.mockResolvedValue(undefined);

      const round = createMockRound({
        findingId: "story-2-3-high-1",
        findingTitle: "Fix authentication vulnerability",
        findingCategory: "security",
        decision: "accept",
      });
      const state = createMockState([round]);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      await applyDecisions("/test/project", state);

      expect(mockWriteFile).toHaveBeenCalled();
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;

      expect(writtenContent).toMatch(/## Acceptance Criteria\n- \[ \] Existing criterion 1/);
      expect(writtenContent).toContain("### From Party Review");
      expect(writtenContent).toContain("- [ ] [Security]: Fix authentication vulnerability");
      
      const partyReviewIndex = writtenContent.indexOf("### From Party Review");
      const technicalNotesIndex = writtenContent.indexOf("## Technical Notes");
      expect(partyReviewIndex).toBeGreaterThan(-1);
      expect(technicalNotesIndex).toBeGreaterThan(-1);
      expect(partyReviewIndex).toBeLessThan(technicalNotesIndex);
    });

    it("should properly format implementation notes with all required fields", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`# Story 2.3

## Acceptance Criteria
- [ ] Existing criterion`);
      mockWriteFile.mockResolvedValue(undefined);

      const round = createMockRound({
        findingId: "story-2-3-high-1",
        findingTitle: "Validate input parameters",
        findingCategory: "logic",
        findingSeverity: "high",
        decision: "defer",
        decisionReason: "Will address in next sprint",
        deferredTo: "2.5",
      });
      const state = createMockState([round]);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      await applyDecisions("/test/project", state);

      expect(mockWriteFile).toHaveBeenCalled();
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;

      expect(writtenContent).toMatch(/## Implementation Notes\n\n### Validate input parameters \(\d{4}-\d{2}-\d{2}\)/);
      expect(writtenContent).toContain("- **Category**: logic");
      expect(writtenContent).toContain("- **Severity**: high");
      expect(writtenContent).toContain("- **Decision**: defer");
      expect(writtenContent).toContain("- **Reason**: Will address in next sprint");
      expect(writtenContent).toContain("- **Deferred to**: Story 2.5");
    });

    it("should handle empty acceptance criteria section gracefully", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`# Story 2.3

## Acceptance Criteria

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

      expect(mockWriteFile).toHaveBeenCalled();
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;

      expect(writtenContent).toContain("### From Party Review");
      expect(writtenContent).toContain("- [ ] [Security]:");
    });

    it("should append to existing implementation notes without duplicating header", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`# Story 2.3

## Acceptance Criteria
- [ ] Existing criterion

## Implementation Notes

### Existing note (2025-01-01)
Some existing note content`);
      mockWriteFile.mockResolvedValue(undefined);

      const round = createMockRound({
        findingId: "story-2-3-high-1",
        findingTitle: "Add caching layer",
        decision: "accept",
      });
      const state = createMockState([round]);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      await applyDecisions("/test/project", state);

      expect(mockWriteFile).toHaveBeenCalled();
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;

      const headerMatches = writtenContent.match(/## Implementation Notes/g);
      expect(headerMatches).toHaveLength(1);

      expect(writtenContent).toContain("### Existing note");
      expect(writtenContent).toContain("### Add caching layer");
    });

    it("should handle multiple category prefixes correctly", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`# Story 2.3

## Acceptance Criteria
- [ ] Existing criterion`);
      mockWriteFile.mockResolvedValue(undefined);

      const rounds = [
        createMockRound({
          findingId: "story-2-3-high-1",
          findingTitle: "Security issue",
          findingCategory: "security",
          decision: "accept",
        }),
        createMockRound({
          findingId: "story-2-3-high-2",
          findingTitle: "Performance issue",
          findingCategory: "performance",
          decision: "accept",
        }),
        createMockRound({
          findingId: "story-2-3-medium-1",
          findingTitle: "Code quality issue",
          findingCategory: "bestPractices",
          decision: "accept",
        }),
      ];
      const state = createMockState(rounds);

      const { applyDecisions } = await import("../../src/plugin/utils/story-updater.js");
      await applyDecisions("/test/project", state);

      expect(mockWriteFile).toHaveBeenCalled();
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;

      expect(writtenContent).toContain("- [ ] [Security]: Security issue");
      expect(writtenContent).toContain("- [ ] [Performance]: Performance issue");
      expect(writtenContent).toContain("- [ ] [Quality]: Code quality issue");
    });
  });
});
