import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  AppliedStoryUpdate,
  ApplyDecisionsResult,
  AthenaConfig,
  DiscussionRound,
  ParsedDeferTarget,
  PartyDiscussionState,
} from "../../shared/types.js";
import { getBmadPaths } from "./bmad-finder.js";
import { findStoryFile } from "./story-loader.js";
import {
  generateStoryContent,
  generateTitleFromFindings,
  getExistingStoryIds,
  loadTemplateFromExistingStory,
  parseDeferTarget,
  roundsToFindings,
  storyIdToFilename,
} from "./story-template.js";
import { addStoryToSprintStatus } from "./yaml-handler.js";

interface StoryUpdate {
  storyId: string;
  filePath: string;
  addedCriteria: string[];
  addedNotes: string[];
  success: boolean;
  error?: string;
}

function groupDecisionsByStory(rounds: DiscussionRound[]): Map<string, DiscussionRound[]> {
  const byStory = new Map<string, DiscussionRound[]>();

  for (const round of rounds) {
    const storyMatch = round.findingId.match(/story-?(\d+[.-]\d+[a-z]?)/i);
    const storyId = storyMatch ? storyMatch[1].replace("-", ".") : "unknown";

    const existing = byStory.get(storyId) || [];
    existing.push(round);
    byStory.set(storyId, existing);
  }

  return byStory;
}

function groupDeferredByTarget(
  rounds: DiscussionRound[],
  epicNumber: string,
  existingStoryIds: string[]
): Map<string, { target: ParsedDeferTarget; rounds: DiscussionRound[] }> {
  const byTarget = new Map<string, { target: ParsedDeferTarget; rounds: DiscussionRound[] }>();

  for (const round of rounds) {
    if (round.decision !== "defer" || !round.deferredTo) continue;

    const target = parseDeferTarget(round.deferredTo, epicNumber, existingStoryIds);
    const key = target.storyId;

    const existing = byTarget.get(key);
    if (existing) {
      existing.rounds.push(round);
    } else {
      byTarget.set(key, { target, rounds: [round] });
    }
  }

  return byTarget;
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
  const storyId = filePath.match(/story-(\d+-\d+[a-z]?)/)?.[1]?.replace("-", ".") || "unknown";

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
      const acSection = content.match(/## Acceptance Criteria[\s\S]*?(?=\n##|\n---|$)/);

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

async function appendToExistingStory(
  filePath: string,
  rounds: DiscussionRound[],
  originalStoryId: string
): Promise<AppliedStoryUpdate> {
  const storyId = filePath.match(/story-(\d+-\d+[a-z]?)/)?.[1]?.replace("-", ".") || "unknown";

  if (!existsSync(filePath)) {
    return {
      storyId,
      filePath,
      action: "appended",
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
    const date = new Date().toISOString().split("T")[0];

    const hasNotesSection = content.includes("## Implementation Notes");
    const deferralHeader = `\n\n### Deferred from Story ${originalStoryId} (${date})\n\n`;
    const notes = rounds.map((r) => {
      const prefix = getCategoryPrefix(r.findingCategory);
      return `- [ ] ${prefix}: ${r.findingTitle}${r.decisionReason ? ` (${r.decisionReason})` : ""}`;
    });
    const notesText = deferralHeader + notes.join("\n");

    if (hasNotesSection) {
      const notesMatch = content.match(/## Implementation Notes/);
      if (notesMatch && notesMatch.index !== undefined) {
        const insertPoint = notesMatch.index + notesMatch[0].length;
        content = `${content.slice(0, insertPoint)}${notesText}${content.slice(insertPoint)}`;
      }
    } else {
      content = `${content}\n\n## Implementation Notes${notesText}`;
    }

    addedNotes.push(...notes);

    await writeFile(filePath, content, "utf-8");

    return {
      storyId,
      filePath,
      action: "appended",
      addedCriteria,
      addedNotes,
      success: true,
    };
  } catch (error) {
    return {
      storyId,
      filePath,
      action: "appended",
      addedCriteria: [],
      addedNotes: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function createStoryFromDeferredFindings(
  storiesDir: string,
  target: ParsedDeferTarget,
  rounds: DiscussionRound[],
  originalStoryId: string,
  sprintStatusPath: string,
  reviewDocumentPath?: string
): Promise<AppliedStoryUpdate> {
  const epicNumber = target.storyId.split(".")[0];
  const findings = roundsToFindings(rounds, originalStoryId);
  const title = generateTitleFromFindings(findings);
  const date = new Date().toISOString().split("T")[0];

  const template = await loadTemplateFromExistingStory(storiesDir, epicNumber);

  const context = {
    storyId: target.storyId,
    epicNumber,
    storyNumber: target.storyId.split(".")[1],
    title,
    findings,
    originalStoryId,
    reviewDate: date,
    reviewDocumentPath,
  };

  const content = generateStoryContent(context, template || undefined);
  const filename = storyIdToFilename(target.storyId, title);
  const filePath = join(storiesDir, filename);

  try {
    if (!existsSync(storiesDir)) {
      await mkdir(storiesDir, { recursive: true });
    }

    await writeFile(filePath, content, "utf-8");

    await addStoryToSprintStatus(sprintStatusPath, target.storyId, "backlog");

    return {
      storyId: target.storyId,
      filePath,
      action: "created",
      addedCriteria: findings.map((f) => `- [ ] [${f.category}]: ${f.title}`),
      addedNotes: [],
      success: true,
      deferTarget: target,
    };
  } catch (error) {
    return {
      storyId: target.storyId,
      filePath,
      action: "created",
      addedCriteria: [],
      addedNotes: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      deferTarget: target,
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

export async function generateDecisionsAppliedDocument(
  reviewFolderPath: string,
  state: PartyDiscussionState,
  result: ApplyDecisionsResult
): Promise<string | null> {
  const date = new Date().toISOString().split("T")[0];
  const docPath = join(reviewFolderPath, "decisions-applied.md");

  const storiesUpdatedList = result.storiesUpdated
    .filter((s) => s.success)
    .map(
      (s) =>
        `- ✅ Updated: ${s.filePath} (${s.addedCriteria.length} criteria, ${s.addedNotes.length} notes)`
    )
    .join("\n");

  const storiesCreatedList = result.storiesCreated
    .filter((s) => s.success)
    .map((s) => `- 📝 Created: ${s.filePath} (${s.addedCriteria.length} criteria)`)
    .join("\n");

  const storiesAppendedList = result.storiesAppended
    .filter((s) => s.success)
    .map((s) => `- 📎 Appended to: ${s.filePath} (${s.addedNotes.length} items)`)
    .join("\n");

  const failedList = [...result.storiesUpdated, ...result.storiesCreated, ...result.storiesAppended]
    .filter((s) => !s.success)
    .map((s) => `- ❌ Failed: ${s.storyId} - ${s.error}`)
    .join("\n");

  const content = `# Decisions Applied

**Date**: ${date}
**Session ID**: ${state.sessionId}
**Scope**: ${state.scope} - ${state.identifier}

## Summary

| Metric | Count |
|--------|-------|
| Findings Accepted | ${result.summary.accepted} |
| Findings Deferred | ${result.summary.deferred} |
| Findings Rejected | ${result.summary.rejected} |
| Stories Modified | ${result.summary.storiesModified} |
| Stories Created | ${result.summary.storiesCreated} |

## Applied Changes

### Stories Updated
${storiesUpdatedList || "(none)"}

### Stories Created
${storiesCreatedList || "(none)"}

### Stories Appended To
${storiesAppendedList || "(none)"}

${failedList ? `### Failed Operations\n${failedList}` : ""}

${result.warnings && result.warnings.length > 0 ? `## Warnings\n${result.warnings.map((w) => `- ⚠️ ${w}`).join("\n")}` : ""}

## Next Steps

${result.storiesCreated.length > 0 ? "- New stories created with status 'backlog' and added to sprint-status.yaml" : ""}
${result.storiesUpdated.length > 0 ? "- Updated stories have new acceptance criteria from the party review" : ""}
${result.storiesAppended.length > 0 ? "- Existing stories have deferred findings in their Implementation Notes section" : ""}
- Run \`/athena-dev\` to implement the next story

---

*Generated by OpenCode Athena Party Review*
`;

  try {
    await writeFile(docPath, content, "utf-8");
    return docPath;
  } catch {
    return null;
  }
}

export async function applyDecisions(
  projectRoot: string,
  state: PartyDiscussionState,
  reviewDocumentPath?: string,
  config?: AthenaConfig
): Promise<ApplyDecisionsResult> {
  const paths = await getBmadPaths(projectRoot, config);
  const byStory = groupDecisionsByStory(state.completedRounds);
  const epicNumber = state.identifier.split(".")[0];

  const existingStoryIds = await getExistingStoryIds(paths.storiesDir, epicNumber);

  const storiesUpdated: AppliedStoryUpdate[] = [];
  const storiesCreated: AppliedStoryUpdate[] = [];
  const storiesAppended: AppliedStoryUpdate[] = [];
  const warnings: string[] = [];

  let totalAccepted = 0;
  let totalDeferred = 0;
  let totalRejected = 0;

  for (const [storyId, rounds] of byStory) {
    if (storyId === "unknown") continue;

    const storyFileResult = await findStoryFile(paths.storiesDir, storyId);
    if (!storyFileResult) {
      continue;
    }

    const accepted = rounds.filter((r) => r.decision === "accept");
    const deferred = rounds.filter((r) => r.decision === "defer");
    const rejected = rounds.filter((r) => r.decision === "reject");

    totalAccepted += accepted.length;
    totalDeferred += deferred.length;
    totalRejected += rejected.length;

    if (accepted.length > 0 || deferred.length > 0) {
      const update = await updateStoryFile(storyFileResult.path, accepted, deferred);
      storiesUpdated.push({
        ...update,
        action: "updated",
      });
    }
  }

  const deferredRounds = state.completedRounds.filter(
    (r) => r.decision === "defer" && r.deferredTo
  );
  const deferredByTarget = groupDeferredByTarget(deferredRounds, epicNumber, existingStoryIds);

  for (const [targetId, { target, rounds }] of deferredByTarget) {
    const originalStoryId = state.identifier;

    if (target.type === "append-existing") {
      const storyFileResult = await findStoryFile(paths.storiesDir, targetId);
      if (storyFileResult) {
        const appendResult = await appendToExistingStory(
          storyFileResult.path,
          rounds,
          originalStoryId
        );
        storiesAppended.push(appendResult);
      } else {
        warnings.push(`Could not find story ${targetId} to append deferred findings`);
      }
    } else if (
      target.type === "exact" ||
      target.type === "new-end" ||
      target.type === "new-after" ||
      target.type === "new-before"
    ) {
      const reviewFolder = reviewDocumentPath ? dirname(reviewDocumentPath) : undefined;
      const createResult = await createStoryFromDeferredFindings(
        paths.storiesDir,
        target,
        rounds,
        originalStoryId,
        paths.sprintStatus,
        reviewFolder
      );
      storiesCreated.push(createResult);

      if (
        target.originalInput.toLowerCase().includes("next sprint") ||
        target.originalInput.toLowerCase().includes("later")
      ) {
        warnings.push(
          `Story ${targetId} created for vague defer target "${target.originalInput}" - review sprint-status.yaml for correct ordering`
        );
      }
    }
  }

  let reviewDocumentUpdated = false;
  if (reviewDocumentPath) {
    reviewDocumentUpdated = await updateReviewDocument(reviewDocumentPath, state);
  }

  const result: ApplyDecisionsResult = {
    success: true,
    storiesUpdated,
    storiesCreated,
    storiesAppended,
    reviewDocumentUpdated,
    summary: {
      accepted: totalAccepted,
      deferred: totalDeferred,
      rejected: totalRejected,
      storiesModified: storiesUpdated.filter((u) => u.success).length,
      storiesCreated: storiesCreated.filter((u) => u.success).length,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  const reviewFolder = reviewDocumentPath ? dirname(reviewDocumentPath) : null;
  if (reviewFolder) {
    const docPath = await generateDecisionsAppliedDocument(reviewFolder, state, result);
    if (docPath) {
      result.decisionsAppliedDocument = docPath;
    }
  }

  return result;
}

export function formatAppliedUpdatesSummary(result: ApplyDecisionsResult): string {
  const parts: string[] = [];

  parts.push("## Decisions Applied\n");
  parts.push("**Summary**:");
  parts.push(`- ✅ Accepted findings: ${result.summary.accepted}`);
  parts.push(`- ⏸️ Deferred findings: ${result.summary.deferred}`);
  parts.push(`- ❌ Rejected findings: ${result.summary.rejected}`);
  parts.push(`- 📝 Stories modified: ${result.summary.storiesModified}`);
  parts.push(`- 📄 Stories created: ${result.summary.storiesCreated}`);
  parts.push("");

  if (result.storiesUpdated.length > 0) {
    parts.push("### Updated Stories\n");
    for (const update of result.storiesUpdated) {
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
    parts.push("");
  }

  if (result.storiesCreated.length > 0) {
    parts.push("### Created Stories\n");
    for (const created of result.storiesCreated) {
      if (created.success) {
        parts.push(`- 📄 ${created.filePath}`);
        parts.push(`  - Story ID: ${created.storyId}`);
        parts.push(
          `  - ${created.addedCriteria.length} acceptance criteria from deferred findings`
        );
      } else {
        parts.push(`- ❌ Failed to create ${created.storyId}: ${created.error}`);
      }
    }
    parts.push("");
  }

  if (result.storiesAppended.length > 0) {
    parts.push("### Appended to Existing Stories\n");
    for (const appended of result.storiesAppended) {
      if (appended.success) {
        parts.push(`- 📎 ${appended.filePath}`);
        parts.push(
          `  - ${appended.addedNotes.length} deferred items added to Implementation Notes`
        );
      } else {
        parts.push(`- ❌ Failed to append to ${appended.storyId}: ${appended.error}`);
      }
    }
    parts.push("");
  }

  if (result.warnings && result.warnings.length > 0) {
    parts.push("### Warnings\n");
    for (const warning of result.warnings) {
      parts.push(`- ⚠️ ${warning}`);
    }
    parts.push("");
  }

  if (result.decisionsAppliedDocument) {
    parts.push("### Documentation\n");
    parts.push(`- 📋 Decisions applied document: ${result.decisionsAppliedDocument}`);
  }

  if (result.reviewDocumentUpdated) {
    parts.push("- 📄 Review document updated with decisions");
  }

  return parts.join("\n");
}

export function formatUpdateSummary(result: ApplyDecisionsResult): string {
  return formatAppliedUpdatesSummary(result);
}
