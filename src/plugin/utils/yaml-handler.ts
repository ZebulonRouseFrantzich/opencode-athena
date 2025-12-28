import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type {
  BmadDevelopmentStatus,
  BmadSprintStatus,
  BmadStoryStatus,
  ParsedDevelopmentKey,
  ParsedEpicKey,
  ParsedStoryKey,
} from "../../shared/types.js";
import { createPluginLogger } from "./plugin-logger.js";

const log = createPluginLogger("yaml-handler");

const LOCK_EXT = ".lock";
const LOCK_TIMEOUT = 10000;
const LOCK_RETRY_INTERVAL = 50;
const STALE_LOCK_AGE = 30000;

async function acquireLock(filePath: string): Promise<() => Promise<void>> {
  const lockPath = `${filePath}${LOCK_EXT}`;
  const startTime = Date.now();
  const lockId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  while (Date.now() - startTime < LOCK_TIMEOUT) {
    try {
      if (existsSync(lockPath)) {
        const lockContent = await readFile(lockPath, "utf-8").catch(() => null);
        if (lockContent) {
          try {
            const lockData = JSON.parse(lockContent);
            const lockAge = Date.now() - lockData.timestamp;
            if (lockAge > STALE_LOCK_AGE) {
              await rm(lockPath, { force: true });
            }
          } catch {
            await rm(lockPath, { force: true });
          }
        }
      }

      const lockData = JSON.stringify({
        id: lockId,
        pid: process.pid,
        timestamp: Date.now(),
      });

      await writeFile(lockPath, lockData, { flag: "wx" });

      return async () => {
        try {
          const currentContent = await readFile(lockPath, "utf-8").catch(() => null);
          if (currentContent) {
            const currentData = JSON.parse(currentContent);
            if (currentData.id === lockId) {
              await rm(lockPath, { force: true });
            }
          }
        } catch {
          // Ignore errors during unlock
        }
      };
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "EEXIST") {
        throw error;
      }
      await sleep(LOCK_RETRY_INTERVAL);
    }
  }

  throw new Error(`Failed to acquire lock for ${filePath} within ${LOCK_TIMEOUT}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readYamlFile<T = unknown>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return parseYaml(content) as T;
  } catch (error) {
    log.warn("Failed to parse YAML file", { filePath, error });
    return null;
  }
}

export async function writeYamlFile<T = unknown>(filePath: string, data: T): Promise<void> {
  const content = stringifyYaml(data, {
    indent: 2,
    lineWidth: 120,
  });
  await writeFile(filePath, content, "utf-8");
}

// =============================================================================
// BMAD v6 Key Parsing Functions
// =============================================================================

const STORY_KEY_PATTERN = /^(\d+)-(\d+)(?:-(.+))?$/;
const EPIC_KEY_PATTERN = /^epic-(\d+)$/;
const RETRO_KEY_PATTERN = /^epic-(\d+)-retrospective$/;

export function parseStoryKey(key: string): ParsedStoryKey | null {
  const match = key.match(STORY_KEY_PATTERN);
  if (!match) return null;

  return {
    epicNum: match[1],
    storyNum: match[2],
    titleSlug: match[3] || undefined,
    fullKey: key,
    normalizedId: `${match[1]}-${match[2]}`,
  };
}

export function parseEpicKey(key: string): ParsedEpicKey | null {
  const match = key.match(EPIC_KEY_PATTERN);
  if (!match) return null;

  return {
    epicNum: match[1],
    fullKey: key,
  };
}

export function parseRetroKey(key: string): { epicNum: string; fullKey: string } | null {
  const match = key.match(RETRO_KEY_PATTERN);
  if (!match) return null;

  return {
    epicNum: match[1],
    fullKey: key,
  };
}

export function parseDevelopmentKey(key: string): ParsedDevelopmentKey {
  const retroParsed = parseRetroKey(key);
  if (retroParsed) {
    return { type: "retrospective", parsed: retroParsed };
  }

  const epicParsed = parseEpicKey(key);
  if (epicParsed) {
    return { type: "epic", parsed: epicParsed };
  }

  const storyParsed = parseStoryKey(key);
  if (storyParsed) {
    return { type: "story", parsed: storyParsed };
  }

  return { type: "unknown", key };
}

export function normalizeStoryId(storyId: string): string {
  return storyId.replace(".", "-");
}

export function storyIdToDotFormat(storyId: string): string {
  const match = storyId.match(/^(\d+)-(\d+)/);
  if (match) {
    return `${match[1]}.${match[2]}`;
  }
  return storyId;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// =============================================================================
// BMAD v6 Sprint Status Read/Write
// =============================================================================

export async function readBmadSprintStatus(filePath: string): Promise<BmadSprintStatus | null> {
  const raw = await readYamlFile<Partial<BmadSprintStatus>>(filePath);

  if (!raw) {
    return null;
  }

  return {
    development_status: {},
    ...raw,
  };
}

export async function writeBmadSprintStatus(
  filePath: string,
  status: BmadSprintStatus
): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const releaseLock = await acquireLock(filePath);

  try {
    const currentStatus = await readBmadSprintStatus(filePath);

    let statusToWrite = status;

    if (currentStatus) {
      if (
        status.last_modified &&
        currentStatus.last_modified &&
        currentStatus.last_modified !== status.last_modified
      ) {
        statusToWrite = mergeBmadSprintStatus(currentStatus, status);
      }
    }

    statusToWrite.last_modified = new Date().toISOString();
    await writeYamlFile(filePath, statusToWrite);
  } finally {
    await releaseLock();
  }
}

function mergeBmadSprintStatus(
  current: BmadSprintStatus,
  incoming: BmadSprintStatus
): BmadSprintStatus {
  const merged: BmadSprintStatus = {
    ...current,
    development_status: { ...current.development_status },
  };

  for (const [key, status] of Object.entries(incoming.development_status)) {
    merged.development_status[key] = status;
  }

  if (incoming.current_story !== undefined) {
    merged.current_story = incoming.current_story;
  }

  return merged;
}

// =============================================================================
// Story Status Operations (BMAD v6)
// =============================================================================

export interface StorySearchResult {
  key: string;
  status: BmadDevelopmentStatus;
  parsed: ParsedStoryKey;
}

export function findStoryInStatus(
  status: BmadSprintStatus,
  storyId: string
): StorySearchResult | null {
  const normalizedSearch = normalizeStoryId(storyId);

  for (const [key, statusValue] of Object.entries(status.development_status)) {
    const parsed = parseStoryKey(key);
    if (parsed && parsed.normalizedId === normalizedSearch) {
      return {
        key,
        status: statusValue,
        parsed,
      };
    }
  }

  return null;
}

export function findStoriesByStatus(
  status: BmadSprintStatus,
  targetStatus: BmadStoryStatus
): StorySearchResult[] {
  const results: StorySearchResult[] = [];

  for (const [key, statusValue] of Object.entries(status.development_status)) {
    if (statusValue !== targetStatus) continue;

    const parsed = parseStoryKey(key);
    if (parsed) {
      results.push({ key, status: statusValue, parsed });
    }
  }

  return results.sort((a, b) => compareStoryKeys(a.parsed, b.parsed));
}

function compareStoryKeys(a: ParsedStoryKey, b: ParsedStoryKey): number {
  const epicA = Number.parseInt(a.epicNum, 10);
  const epicB = Number.parseInt(b.epicNum, 10);
  if (epicA !== epicB) return epicA - epicB;

  const numA = Number.parseInt(a.storyNum, 10);
  const numB = Number.parseInt(b.storyNum, 10);
  return numA - numB;
}

export function findNextReadyStory(status: BmadSprintStatus): StorySearchResult | null {
  if (status.current_story) {
    const current = findStoryInStatus(status, status.current_story);
    if (current) return current;
  }

  const inProgress = findStoriesByStatus(status, "in-progress");
  if (inProgress.length > 0) return inProgress[0];

  const readyForDev = findStoriesByStatus(status, "ready-for-dev");
  if (readyForDev.length > 0) return readyForDev[0];

  const backlog = findStoriesByStatus(status, "backlog");
  if (backlog.length > 0) return backlog[0];

  return null;
}

export async function updateStoryStatus(
  filePath: string,
  storyId: string,
  newStatus: BmadStoryStatus,
  storyTitle?: string
): Promise<{ success: boolean; key: string; previousStatus?: BmadDevelopmentStatus }> {
  const status = await readBmadSprintStatus(filePath);
  if (!status) {
    return { success: false, key: "" };
  }

  const existing = findStoryInStatus(status, storyId);

  let key: string;
  let previousStatus: BmadDevelopmentStatus | undefined;

  if (existing) {
    key = existing.key;
    previousStatus = existing.status;
  } else {
    const normalizedId = normalizeStoryId(storyId);
    key = storyTitle ? `${normalizedId}-${slugify(storyTitle)}` : normalizedId;
  }

  status.development_status[key] = newStatus;

  if (newStatus === "in-progress") {
    status.current_story = normalizeStoryId(storyId);
  } else if (newStatus === "done" || newStatus === "blocked") {
    if (status.current_story === normalizeStoryId(storyId)) {
      status.current_story = null;
    }
  }

  await writeBmadSprintStatus(filePath, status);

  return { success: true, key, previousStatus };
}

// =============================================================================
// Epic Status Operations (BMAD v6)
// =============================================================================

export function findEpicKey(status: BmadSprintStatus, epicNum: string): string | null {
  const epicKey = `epic-${epicNum}`;
  if (epicKey in status.development_status) {
    return epicKey;
  }
  return null;
}

export function getStoriesForEpic(status: BmadSprintStatus, epicNum: string): StorySearchResult[] {
  const results: StorySearchResult[] = [];

  for (const [key, statusValue] of Object.entries(status.development_status)) {
    const parsed = parseStoryKey(key);
    if (parsed && parsed.epicNum === epicNum) {
      results.push({ key, status: statusValue, parsed });
    }
  }

  return results.sort((a, b) => compareStoryKeys(a.parsed, b.parsed));
}

export async function updateEpicStatusIfNeeded(
  filePath: string,
  epicNum: string
): Promise<{ updated: boolean; newStatus?: BmadDevelopmentStatus }> {
  const status = await readBmadSprintStatus(filePath);
  if (!status) {
    return { updated: false };
  }

  const epicKey = findEpicKey(status, epicNum);
  if (!epicKey) {
    return { updated: false };
  }

  const currentEpicStatus = status.development_status[epicKey];
  const stories = getStoriesForEpic(status, epicNum);

  if (stories.length === 0) {
    return { updated: false };
  }

  const allDone = stories.every((s) => s.status === "done");
  const anyInProgress = stories.some(
    (s) => s.status === "in-progress" || s.status === "review" || s.status === "ready-for-dev"
  );

  let newStatus: BmadDevelopmentStatus | undefined;

  if (allDone && currentEpicStatus !== "done") {
    newStatus = "done";
  } else if (anyInProgress && currentEpicStatus === "backlog") {
    newStatus = "in-progress";
  }

  if (newStatus) {
    status.development_status[epicKey] = newStatus;
    await writeBmadSprintStatus(filePath, status);
    return { updated: true, newStatus };
  }

  return { updated: false };
}

// =============================================================================
// Add Story to Sprint Status (BMAD v6)
// =============================================================================

export async function addStoryToBmadSprintStatus(
  filePath: string,
  storyId: string,
  storyTitle?: string,
  initialStatus: BmadStoryStatus = "backlog"
): Promise<{ success: boolean; key: string }> {
  const status = await readBmadSprintStatus(filePath);
  if (!status) {
    return { success: false, key: "" };
  }

  const existing = findStoryInStatus(status, storyId);
  if (existing) {
    return { success: true, key: existing.key };
  }

  const normalizedId = normalizeStoryId(storyId);
  const key = storyTitle ? `${normalizedId}-${slugify(storyTitle)}` : normalizedId;

  status.development_status[key] = initialStatus;
  await writeBmadSprintStatus(filePath, status);

  return { success: true, key };
}

// =============================================================================
// Sprint Progress Calculation (BMAD v6)
// =============================================================================

export interface SprintProgress {
  total: number;
  done: number;
  inProgress: number;
  readyForDev: number;
  backlog: number;
  blocked: number;
  review: number;
  percentComplete: number;
}

export function calculateSprintProgress(status: BmadSprintStatus): SprintProgress {
  let total = 0;
  let done = 0;
  let inProgress = 0;
  let readyForDev = 0;
  let backlog = 0;
  let blocked = 0;
  let review = 0;

  for (const [key, statusValue] of Object.entries(status.development_status)) {
    const parsed = parseStoryKey(key);
    if (!parsed) continue;

    total++;
    switch (statusValue) {
      case "done":
        done++;
        break;
      case "in-progress":
        inProgress++;
        break;
      case "ready-for-dev":
        readyForDev++;
        break;
      case "backlog":
        backlog++;
        break;
      case "blocked":
        blocked++;
        break;
      case "review":
        review++;
        break;
    }
  }

  const percentComplete = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    total,
    done,
    inProgress,
    readyForDev,
    backlog,
    blocked,
    review,
    percentComplete,
  };
}

// =============================================================================
// Legacy Compatibility (Deprecated)
// =============================================================================

import type { SprintStatus } from "../../shared/types.js";

/** @deprecated Use readBmadSprintStatus instead */
export async function readSprintStatus(filePath: string): Promise<SprintStatus | null> {
  const raw = await readYamlFile<Partial<SprintStatus>>(filePath);

  if (!raw) {
    return null;
  }

  return {
    completed_stories: [],
    pending_stories: [],
    in_progress_stories: [],
    blocked_stories: [],
    ...raw,
  };
}

/** @deprecated Use writeBmadSprintStatus instead */
export async function writeSprintStatus(filePath: string, status: SprintStatus): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const releaseLock = await acquireLock(filePath);

  try {
    status.last_modified = new Date().toISOString();
    await writeYamlFile(filePath, status);
  } finally {
    await releaseLock();
  }
}

/** @deprecated Use addStoryToBmadSprintStatus instead */
export async function addStoryToSprintStatus(
  filePath: string,
  storyId: string,
  _status: "pending" | "backlog" = "backlog"
): Promise<void> {
  await addStoryToBmadSprintStatus(filePath, storyId, undefined, "backlog");
}

/** @deprecated No longer needed with flat map structure */
export function insertStoryInOrder(stories: string[], newStoryId: string): string[] {
  const normalizedId = newStoryId.replace(".", "-");

  if (stories.includes(normalizedId)) {
    return stories;
  }

  const result = [...stories, normalizedId];
  result.sort((a, b) => {
    const parsedA = parseStoryKey(a);
    const parsedB = parseStoryKey(b);
    if (!parsedA || !parsedB) return 0;
    return compareStoryKeys(parsedA, parsedB);
  });
  return result;
}
