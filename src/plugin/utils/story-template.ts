import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { DiscussionRound, FindingCategory, ParsedDeferTarget } from "../../shared/types.js";
import { findStoriesForEpic } from "./story-loader.js";

interface DeferredFinding {
  id: string;
  title: string;
  description?: string;
  category: FindingCategory;
  severity: string;
  reason?: string;
  originalStoryId: string;
}

interface StoryTemplateContext {
  storyId: string;
  epicNumber: string;
  storyNumber: string;
  title: string;
  findings: DeferredFinding[];
  originalStoryId: string;
  reviewDate: string;
  reviewDocumentPath?: string;
}

export function parseDeferTarget(
  input: string,
  epicNumber: string,
  existingStoryIds: string[]
): ParsedDeferTarget {
  const normalized = input.trim().toLowerCase();
  const originalInput = input.trim();

  const exactMatch = originalInput.match(/^(\d+)\.(\d+[a-z]?)$/i);
  if (exactMatch) {
    const storyId = `${exactMatch[1]}.${exactMatch[2]}`;
    const exists = existingStoryIds.includes(storyId);
    return {
      type: exists ? "append-existing" : "exact",
      storyId,
      originalInput,
    };
  }

  const dashMatch = originalInput.match(/^(\d+)-(\d+[a-z]?)$/i);
  if (dashMatch) {
    const storyId = `${dashMatch[1]}.${dashMatch[2]}`;
    const exists = existingStoryIds.includes(storyId);
    return {
      type: exists ? "append-existing" : "exact",
      storyId,
      originalInput,
    };
  }

  if (normalized.includes("new story after")) {
    const afterMatch = normalized.match(/after\s+(\d+\.?\d*[a-z]?)/);
    if (afterMatch) {
      const refId = afterMatch[1].includes(".") ? afterMatch[1] : `${epicNumber}.${afterMatch[1]}`;
      const nextSubId = getNextSubNumber(refId, existingStoryIds);
      return {
        type: "new-after",
        storyId: nextSubId,
        referenceStoryId: refId,
        originalInput,
      };
    }
  }

  if (normalized.includes("new story before")) {
    const beforeMatch = normalized.match(/before\s+(\d+\.?\d*[a-z]?)/);
    if (beforeMatch) {
      const refId = beforeMatch[1].includes(".")
        ? beforeMatch[1]
        : `${epicNumber}.${beforeMatch[1]}`;
      const [epicNum, storyNum] = refId.split(".");
      const prevNum = Number.parseInt(storyNum, 10) - 1;
      if (prevNum > 0) {
        const prevId = `${epicNum}.${prevNum}`;
        const nextSubId = getNextSubNumber(prevId, existingStoryIds);
        return {
          type: "new-before",
          storyId: nextSubId,
          referenceStoryId: refId,
          originalInput,
        };
      }
    }
  }

  if (normalized.includes("new story") || normalized === "new" || normalized === "end of epic") {
    const nextId = getNextStoryNumber(epicNumber, existingStoryIds);
    return {
      type: "new-end",
      storyId: nextId,
      originalInput,
    };
  }

  if (
    normalized.includes("next sprint") ||
    normalized.includes("later") ||
    normalized.includes("backlog")
  ) {
    const nextId = getNextStoryNumber(epicNumber, existingStoryIds);
    return {
      type: "new-end",
      storyId: nextId,
      originalInput,
    };
  }

  const storyIdMatch = originalInput.match(/(\d+)[.\-](\d+[a-z]?)/i);
  if (storyIdMatch) {
    const storyId = `${storyIdMatch[1]}.${storyIdMatch[2]}`;
    const exists = existingStoryIds.includes(storyId);
    return {
      type: exists ? "append-existing" : "exact",
      storyId,
      originalInput,
    };
  }

  const nextId = getNextStoryNumber(epicNumber, existingStoryIds);
  return {
    type: "new-end",
    storyId: nextId,
    originalInput,
  };
}

export function getNextSubNumber(afterStoryId: string, existingIds: string[]): string {
  const [epicNum, storyNum] = afterStoryId.split(".");
  const baseNum = storyNum.replace(/[a-z]+$/i, "");

  const existingSubs = existingIds
    .filter((id) => {
      const [e, s] = id.split(".");
      return e === epicNum && s.startsWith(baseNum) && /[a-z]$/i.test(s);
    })
    .map((id) => {
      const suffix = id.split(".")[1].replace(/^\d+/, "");
      return suffix;
    })
    .filter((s) => s.length > 0)
    .sort();

  if (existingSubs.length === 0) {
    return `${epicNum}.${baseNum}a`;
  }

  const lastSuffix = existingSubs[existingSubs.length - 1];
  const nextChar = String.fromCharCode(lastSuffix.charCodeAt(lastSuffix.length - 1) + 1);
  return `${epicNum}.${baseNum}${nextChar}`;
}

export function getNextStoryNumber(epicNumber: string, existingIds: string[]): string {
  const epicIds = existingIds
    .filter((id) => id.startsWith(`${epicNumber}.`))
    .map((id) => {
      const num = id.split(".")[1];
      const baseNum = Number.parseInt(num.replace(/[a-z]+$/i, ""), 10);
      return Number.isNaN(baseNum) ? 0 : baseNum;
    });

  const maxNum = epicIds.length > 0 ? Math.max(...epicIds) : 0;
  return `${epicNumber}.${maxNum + 1}`;
}

export async function getExistingStoryIds(
  storiesDir: string,
  epicNumber: string
): Promise<string[]> {
  const stories = await findStoriesForEpic(storiesDir, epicNumber);
  return stories.map((s) => s.id);
}

export async function loadTemplateFromExistingStory(
  storiesDir: string,
  epicNumber: string
): Promise<string | null> {
  if (!existsSync(storiesDir)) {
    return null;
  }

  const files = await readdir(storiesDir);
  const epicPattern = new RegExp(`^(story-)?${epicNumber}-(\\d+)`, "i");

  const epicFiles = files.filter((f) => epicPattern.test(f) && f.endsWith(".md")).sort();

  if (epicFiles.length === 0) {
    return null;
  }

  const templateFile = epicFiles[0];
  const content = await readFile(join(storiesDir, templateFile), "utf-8");
  return content;
}

function extractTemplateStructure(existingContent: string): string[] {
  const lines = existingContent.split("\n");
  const sections: string[] = [];
  let currentSection = "";

  for (const line of lines) {
    if (line.startsWith("# ") || line.startsWith("## ")) {
      if (currentSection) {
        sections.push(currentSection.trim());
      }
      currentSection = line;
    } else {
      currentSection += `\n${line}`;
    }
  }

  if (currentSection) {
    sections.push(currentSection.trim());
  }

  return sections;
}

export function generateStoryContent(
  context: StoryTemplateContext,
  _existingTemplate?: string
): string {
  const { storyId, title, findings, originalStoryId, reviewDate, reviewDocumentPath } = context;

  const acceptanceCriteria = findings
    .map((f) => {
      const prefix = getCategoryPrefix(f.category);
      return `- [ ] ${prefix}: ${f.title}${f.description ? ` - ${f.description}` : ""}`;
    })
    .join("\n");

  const devNotes = findings
    .map((f) => {
      return `- **${f.title}**
  - Severity: ${f.severity}
  - Category: ${f.category}
  - Reason for deferral: ${f.reason || "Deferred from party review"}`;
    })
    .join("\n");

  const content = `# Story ${storyId}: ${title}

Status: backlog

## Story

As a developer,
I want to address the deferred findings from the party review,
so that the codebase maintains quality standards.

## Acceptance Criteria

${acceptanceCriteria}

## Tasks / Subtasks

- [ ] Review each deferred finding
- [ ] Implement fixes for each acceptance criterion
- [ ] Run quality checks (LSP diagnostics, build, tests)

## Dev Notes

These findings were deferred from the party review of Story ${originalStoryId} on ${reviewDate}.

### Original Context

${devNotes}

### References

${reviewDocumentPath ? `- Party Review: ${reviewDocumentPath}` : ""}
- Original Story: Story ${originalStoryId}

## Dev Agent Record

### Agent Model Used

(To be filled during implementation)

### Completion Notes List

(To be filled during implementation)

### File List

(To be filled during implementation)
`;

  return content;
}

function getCategoryPrefix(category: FindingCategory): string {
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

export function generateTitleFromFindings(findings: DeferredFinding[]): string {
  if (findings.length === 1) {
    const f = findings[0];
    const shortTitle = f.title.length > 50 ? `${f.title.substring(0, 47)}...` : f.title;
    return shortTitle;
  }

  const categories = [...new Set(findings.map((f) => f.category))];
  if (categories.length === 1) {
    return `Deferred ${formatCategory(categories[0])} Findings`;
  }

  return "Deferred Findings from Party Review";
}

function formatCategory(category: FindingCategory): string {
  switch (category) {
    case "security":
      return "Security";
    case "performance":
      return "Performance";
    case "bestPractices":
      return "Quality";
    default:
      return "Logic";
  }
}

export function roundsToFindings(
  rounds: DiscussionRound[],
  originalStoryId: string
): DeferredFinding[] {
  return rounds.map((round) => ({
    id: round.findingId,
    title: round.findingTitle,
    category: round.findingCategory,
    severity: round.findingSeverity,
    reason: round.decisionReason,
    originalStoryId,
  }));
}

export function storyIdToFilename(storyId: string, title?: string): string {
  const [epic, num] = storyId.split(".");
  const kebabTitle = title
    ? `-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 30)}`
    : "";
  return `story-${epic}-${num}${kebabTitle}.md`;
}

export const _testExports = {
  extractTemplateStructure,
  getCategoryPrefix,
  formatCategory,
};
