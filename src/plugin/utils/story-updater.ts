import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DiscussionRound, PartyDiscussionState } from "../../shared/types.js";
import { getBmadPaths } from "./bmad-finder.js";

interface StoryUpdate {
  storyId: string;
  filePath: string;
  addedCriteria: string[];
  addedNotes: string[];
  success: boolean;
  error?: string;
}

interface UpdateResult {
  success: boolean;
  updatedStories: StoryUpdate[];
  reviewDocumentPath?: string;
  summary: {
    accepted: number;
    deferred: number;
    rejected: number;
    storiesUpdated: number;
  };
  error?: string;
}

function groupDecisionsByStory(rounds: DiscussionRound[]): Map<string, DiscussionRound[]> {
  const byStory = new Map<string, DiscussionRound[]>();

  for (const round of rounds) {
    const storyMatch = round.findingId.match(/story-?(\d+[.-]\d+)/i);
    const storyId = storyMatch ? storyMatch[1].replace("-", ".") : "unknown";

    const existing = byStory.get(storyId) || [];
    existing.push(round);
    byStory.set(storyId, existing);
  }

  return byStory;
}

function generateAcceptanceCriteria(round: DiscussionRound): string {
  const prefix = getCategoryPrefix(round.findingCategory);
  return `- [ ] ${prefix}: ${round.findingTitle}`;
}

function getCategoryPrefix(category: string): string {
  switch (category) {
    case "security":
      return "[Security]";
    case "performance":
      return "[Performance]";
    case "bestPractices":
      return "[Quality]";
    default:
      return "[Logic]";
  }
}

function generateImplementationNote(round: DiscussionRound): string {
  const date = new Date().toISOString().split("T")[0];
  let note = `### ${round.findingTitle} (${date})\n`;
  note += `- **Category**: ${round.findingCategory}\n`;
  note += `- **Severity**: ${round.findingSeverity}\n`;
  note += `- **Decision**: ${round.decision}`;

  if (round.decisionReason) {
    note += `\n- **Reason**: ${round.decisionReason}`;
  }

  if (round.deferredTo) {
    note += `\n- **Deferred to**: Story ${round.deferredTo}`;
  }

  return note;
}

async function updateStoryFile(
  filePath: string,
  acceptedRounds: DiscussionRound[],
  deferredRounds: DiscussionRound[]
): Promise<StoryUpdate> {
  const storyId = filePath.match(/story-(\d+-\d+)/)?.[1]?.replace("-", ".") || "unknown";

  if (!existsSync(filePath)) {
    return {
      storyId,
      filePath,
      addedCriteria: [],
      addedNotes: [],
      success: false,
      error: `Story file not found: ${filePath}`,
    };
  }

  try {
    let content = await readFile(filePath, "utf-8");
    const addedCriteria: string[] = [];
    const addedNotes: string[] = [];

    if (acceptedRounds.length > 0) {
      const acSection = content.match(/## Acceptance Criteria[\s\S]*?(?=\n##|\n---|\Z)/);

      if (acSection && acSection.index !== undefined) {
        const newCriteria = acceptedRounds.map(generateAcceptanceCriteria);
        const insertPoint = acSection.index + acSection[0].length;

        const criteriaText = newCriteria.join("\n");
        const insertion = `\n\n### From Party Review\n${criteriaText}`;
        content = `${content.slice(0, insertPoint)}${insertion}${content.slice(insertPoint)}`;

        addedCriteria.push(...newCriteria);
      }
    }

    if (deferredRounds.length > 0 || acceptedRounds.length > 0) {
      const hasNotesSection = content.includes("## Implementation Notes");

      const notes = [
        ...acceptedRounds.map(generateImplementationNote),
        ...deferredRounds.map(generateImplementationNote),
      ];

      if (hasNotesSection) {
        const notesMatch = content.match(/## Implementation Notes/);
        if (notesMatch && notesMatch.index !== undefined) {
          const insertPoint = notesMatch.index + notesMatch[0].length;
          const notesText = notes.join("\n\n");
          const insertion = `\n\n${notesText}`;
          content = `${content.slice(0, insertPoint)}${insertion}${content.slice(insertPoint)}`;
        }
      } else {
        const notesText = notes.join("\n\n");
        content = `${content}\n\n## Implementation Notes\n\n${notesText}`;
      }

      addedNotes.push(...notes);
    }

    await writeFile(filePath, content, "utf-8");

    return {
      storyId,
      filePath,
      addedCriteria,
      addedNotes,
      success: true,
    };
  } catch (error) {
    return {
      storyId,
      filePath,
      addedCriteria: [],
      addedNotes: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function updateReviewDocument(
  reviewPath: string,
  state: PartyDiscussionState
): Promise<boolean> {
  if (!existsSync(reviewPath)) {
    return false;
  }

  try {
    let content = await readFile(reviewPath, "utf-8");

    const decisionSection = generateDecisionSection(state);
    content = `${content}\n\n---\n\n${decisionSection}`;

    await writeFile(reviewPath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}

function generateDecisionSection(state: PartyDiscussionState): string {
  const counts = { accepted: 0, deferred: 0, rejected: 0 };

  for (const round of state.completedRounds) {
    if (round.decision === "accept") counts.accepted++;
    else if (round.decision === "defer") counts.deferred++;
    else if (round.decision === "reject") counts.rejected++;
  }

  const date = new Date().toISOString().split("T")[0];
  const findingLines: string[] = [];

  for (const round of state.completedRounds) {
    const icon = round.decision === "accept" ? "✅" : round.decision === "defer" ? "⏸️" : "❌";
    const lines = [`${icon} **${round.findingTitle}**`, `- Decision: ${round.decision}`];
    if (round.decisionReason) {
      lines.push(`- Reason: ${round.decisionReason}`);
    }
    if (round.deferredTo) {
      lines.push(`- Deferred to: Story ${round.deferredTo}`);
    }
    findingLines.push(lines.join("\n"));
  }

  return `## Party Discussion Decisions

**Date**: ${date}
**Session ID**: ${state.sessionId}

### Summary
- ✅ Accepted: ${counts.accepted}
- ⏸️ Deferred: ${counts.deferred}
- ❌ Rejected: ${counts.rejected}

### Decisions by Finding

${findingLines.join("\n\n")}`;
}

export async function applyDecisions(
  projectRoot: string,
  state: PartyDiscussionState,
  reviewDocumentPath?: string
): Promise<UpdateResult> {
  const paths = await getBmadPaths(projectRoot);
  const byStory = groupDecisionsByStory(state.completedRounds);

  const updatedStories: StoryUpdate[] = [];
  let totalAccepted = 0;
  let totalDeferred = 0;
  let totalRejected = 0;

  for (const [storyId, rounds] of byStory) {
    if (storyId === "unknown") continue;

    const storyFile = join(paths.storiesDir, `story-${storyId.replace(".", "-")}.md`);

    const accepted = rounds.filter((r) => r.decision === "accept");
    const deferred = rounds.filter((r) => r.decision === "defer");
    const rejected = rounds.filter((r) => r.decision === "reject");

    totalAccepted += accepted.length;
    totalDeferred += deferred.length;
    totalRejected += rejected.length;

    if (accepted.length > 0 || deferred.length > 0) {
      const update = await updateStoryFile(storyFile, accepted, deferred);
      updatedStories.push(update);
    }
  }

  if (reviewDocumentPath) {
    await updateReviewDocument(reviewDocumentPath, state);
  }

  return {
    success: true,
    updatedStories,
    reviewDocumentPath,
    summary: {
      accepted: totalAccepted,
      deferred: totalDeferred,
      rejected: totalRejected,
      storiesUpdated: updatedStories.filter((u) => u.success).length,
    },
  };
}

export function formatUpdateSummary(result: UpdateResult): string {
  const parts: string[] = [];

  parts.push("## Story Updates Applied\n");
  parts.push("**Summary**:");
  parts.push(`- ✅ Accepted findings: ${result.summary.accepted}`);
  parts.push(`- ⏸️ Deferred findings: ${result.summary.deferred}`);
  parts.push(`- ❌ Rejected findings: ${result.summary.rejected}`);
  parts.push(`- 📝 Stories updated: ${result.summary.storiesUpdated}`);
  parts.push("");

  if (result.updatedStories.length > 0) {
    parts.push("### Modified Files\n");
    for (const update of result.updatedStories) {
      if (update.success) {
        parts.push(`- ✅ ${update.filePath}`);
        if (update.addedCriteria.length > 0) {
          parts.push(`  - Added ${update.addedCriteria.length} acceptance criteria`);
        }
        if (update.addedNotes.length > 0) {
          parts.push(`  - Added ${update.addedNotes.length} implementation notes`);
        }
      } else {
        parts.push(`- ❌ ${update.filePath}: ${update.error}`);
      }
    }
  }

  if (result.reviewDocumentPath) {
    parts.push("\n### Review Document");
    parts.push(`- Updated: ${result.reviewDocumentPath}`);
  }

  return parts.join("\n");
}
