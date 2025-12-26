/**
 * YAML file handler for sprint-status.yaml
 *
 * Provides read/write utilities with error handling and file locking
 * for safe concurrent access during parallel story execution.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { SprintStatus } from "../../shared/types.js";
import { createPluginLogger } from "./plugin-logger.js";

const log = createPluginLogger("yaml-handler");

/**
 * Lock file extension
 */
const LOCK_EXT = ".lock";

/**
 * Maximum time to wait for a lock (in milliseconds)
 */
const LOCK_TIMEOUT = 10000;

/**
 * Time between lock acquisition attempts (in milliseconds)
 */
const LOCK_RETRY_INTERVAL = 50;

/**
 * Maximum age of a stale lock file (in milliseconds)
 * If a lock is older than this, it's considered stale and can be removed
 */
const STALE_LOCK_AGE = 30000;

/**
 * Acquire a lock for a file
 *
 * Uses a simple lock file approach with stale lock detection.
 * This is a best-effort lock suitable for single-machine scenarios.
 *
 * @param filePath - Path to the file to lock
 * @returns Release function to call when done
 * @throws Error if lock cannot be acquired within timeout
 */
async function acquireLock(filePath: string): Promise<() => Promise<void>> {
  const lockPath = `${filePath}${LOCK_EXT}`;
  const startTime = Date.now();
  const lockId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  while (Date.now() - startTime < LOCK_TIMEOUT) {
    try {
      // Check for existing lock
      if (existsSync(lockPath)) {
        // Check if lock is stale
        const lockContent = await readFile(lockPath, "utf-8").catch(() => null);
        if (lockContent) {
          try {
            const lockData = JSON.parse(lockContent);
            const lockAge = Date.now() - lockData.timestamp;
            if (lockAge > STALE_LOCK_AGE) {
              // Lock is stale, remove it
              await rm(lockPath, { force: true });
            }
          } catch {
            // Invalid lock file, remove it
            await rm(lockPath, { force: true });
          }
        }
      }

      // Try to create lock file with exclusive flag
      // Note: 'wx' flag means write + exclusive (fail if exists)
      const lockData = JSON.stringify({
        id: lockId,
        pid: process.pid,
        timestamp: Date.now(),
      });

      await writeFile(lockPath, lockData, { flag: "wx" });

      // Lock acquired successfully
      return async () => {
        // Only release if we still own the lock
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
      // Check if it's an EEXIST error (lock file already exists)
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "EEXIST") {
        throw error;
      }
      // Lock exists, wait and retry
      await sleep(LOCK_RETRY_INTERVAL);
    }
  }

  throw new Error(`Failed to acquire lock for ${filePath} within ${LOCK_TIMEOUT}ms`);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read and parse a YAML file
 *
 * @param filePath - Path to the YAML file
 * @returns Parsed content or null if file doesn't exist or parse fails
 */
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

/**
 * Write data to a YAML file (without locking)
 *
 * @param filePath - Path to the YAML file
 * @param data - Data to write
 */
export async function writeYamlFile<T = unknown>(filePath: string, data: T): Promise<void> {
  const content = stringifyYaml(data, {
    indent: 2,
    lineWidth: 120,
  });
  await writeFile(filePath, content, "utf-8");
}

/**
 * Read sprint status from YAML file
 *
 * @param filePath - Path to sprint-status.yaml
 * @returns SprintStatus object with defaults applied
 */
export async function readSprintStatus(filePath: string): Promise<SprintStatus | null> {
  const raw = await readYamlFile<Partial<SprintStatus>>(filePath);

  if (!raw) {
    return null;
  }

  // Apply defaults for missing arrays
  return {
    completed_stories: [],
    pending_stories: [],
    in_progress_stories: [],
    blocked_stories: [],
    ...raw,
  };
}

/**
 * Write sprint status to YAML file with file locking
 *
 * This function uses file locking to prevent race conditions when
 * multiple parallel story executions try to update the same file.
 *
 * @param filePath - Path to sprint-status.yaml
 * @param status - SprintStatus object to write
 */
export async function writeSprintStatus(filePath: string, status: SprintStatus): Promise<void> {
  // Ensure directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // Acquire lock before reading and writing
  const releaseLock = await acquireLock(filePath);

  try {
    // Re-read the current state to merge changes
    // This handles the case where another process updated between our read and write
    const currentStatus = await readSprintStatus(filePath);

    let statusToWrite = status;

    if (currentStatus) {
      // Check for concurrent modification using last_modified
      if (
        status.last_modified &&
        currentStatus.last_modified &&
        currentStatus.last_modified !== status.last_modified
      ) {
        // Another process modified the file - merge the changes
        statusToWrite = mergeSprintStatus(currentStatus, status);
      }
    }

    // Update last_modified timestamp
    statusToWrite.last_modified = new Date().toISOString();
    await writeYamlFile(filePath, statusToWrite);
  } finally {
    await releaseLock();
  }
}

function parseStoryIdForSort(storyId: string): { epic: number; num: number; suffix: string } {
  const match = storyId.match(/^(\d+)[.-](\d+)([a-z]*)$/i);
  if (!match) {
    return { epic: 0, num: 0, suffix: "" };
  }
  return {
    epic: Number.parseInt(match[1], 10),
    num: Number.parseInt(match[2], 10),
    suffix: match[3].toLowerCase(),
  };
}

function compareStoryIds(a: string, b: string): number {
  const parsedA = parseStoryIdForSort(a);
  const parsedB = parseStoryIdForSort(b);

  if (parsedA.epic !== parsedB.epic) {
    return parsedA.epic - parsedB.epic;
  }

  if (parsedA.num !== parsedB.num) {
    return parsedA.num - parsedB.num;
  }

  return parsedA.suffix.localeCompare(parsedB.suffix);
}

export function insertStoryInOrder(stories: string[], newStoryId: string): string[] {
  const normalizedId = newStoryId.replace(".", "-");

  if (stories.includes(normalizedId)) {
    return stories;
  }

  const result = [...stories, normalizedId];
  result.sort(compareStoryIds);
  return result;
}

export async function addStoryToSprintStatus(
  filePath: string,
  storyId: string,
  status: "pending" | "backlog" = "backlog"
): Promise<void> {
  const currentStatus = await readSprintStatus(filePath);
  if (!currentStatus) {
    return;
  }

  const normalizedId = storyId.replace(".", "-");

  const isInAnyArray =
    currentStatus.completed_stories?.includes(normalizedId) ||
    currentStatus.pending_stories?.includes(normalizedId) ||
    currentStatus.in_progress_stories?.includes(normalizedId) ||
    currentStatus.blocked_stories?.includes(normalizedId);

  if (isInAnyArray) {
    return;
  }

  currentStatus.pending_stories = insertStoryInOrder(
    currentStatus.pending_stories || [],
    normalizedId
  );

  if (!currentStatus.story_updates) {
    currentStatus.story_updates = {};
  }
  currentStatus.story_updates[normalizedId] = {
    status: status === "backlog" ? "pending" : "pending",
    updated_at: new Date().toISOString(),
    notes: "Added from party review deferred findings",
  };

  await writeSprintStatus(filePath, currentStatus);
}

function mergeSprintStatus(current: SprintStatus, incoming: SprintStatus): SprintStatus {
  // Start with current state
  const merged: SprintStatus = { ...current };

  // Merge story_updates - newer timestamps win
  merged.story_updates = { ...current.story_updates };
  if (incoming.story_updates) {
    for (const [storyId, update] of Object.entries(incoming.story_updates)) {
      const currentUpdate = merged.story_updates?.[storyId];
      if (!currentUpdate || new Date(update.updated_at) > new Date(currentUpdate.updated_at)) {
        merged.story_updates = merged.story_updates || {};
        merged.story_updates[storyId] = update;
      }
    }
  }

  // Rebuild status arrays from story_updates
  // This ensures consistency between arrays and story_updates
  if (merged.story_updates) {
    const statusArrays = {
      completed_stories: new Set<string>(),
      pending_stories: new Set<string>(),
      in_progress_stories: new Set<string>(),
      blocked_stories: new Set<string>(),
      stories_needing_review: new Set<string>(),
    };

    // Add all stories from current arrays first (to catch stories without updates)
    for (const story of current.completed_stories || []) {
      statusArrays.completed_stories.add(story);
    }
    for (const story of current.pending_stories || []) {
      statusArrays.pending_stories.add(story);
    }
    for (const story of current.in_progress_stories || []) {
      statusArrays.in_progress_stories.add(story);
    }
    for (const story of current.blocked_stories || []) {
      statusArrays.blocked_stories.add(story);
    }

    // Update arrays based on story_updates
    for (const [storyId, update] of Object.entries(merged.story_updates)) {
      // Remove from all arrays first
      statusArrays.completed_stories.delete(storyId);
      statusArrays.pending_stories.delete(storyId);
      statusArrays.in_progress_stories.delete(storyId);
      statusArrays.blocked_stories.delete(storyId);
      statusArrays.stories_needing_review.delete(storyId);

      // Add to appropriate array
      switch (update.status) {
        case "completed":
          statusArrays.completed_stories.add(storyId);
          break;
        case "pending":
          statusArrays.pending_stories.add(storyId);
          break;
        case "in_progress":
          statusArrays.in_progress_stories.add(storyId);
          break;
        case "blocked":
          statusArrays.blocked_stories.add(storyId);
          break;
        case "needs_review":
          statusArrays.in_progress_stories.add(storyId);
          statusArrays.stories_needing_review.add(storyId);
          break;
      }
    }

    merged.completed_stories = [...statusArrays.completed_stories];
    merged.pending_stories = [...statusArrays.pending_stories];
    merged.in_progress_stories = [...statusArrays.in_progress_stories];
    merged.blocked_stories = [...statusArrays.blocked_stories];
    merged.stories_needing_review = [...statusArrays.stories_needing_review];
  }

  // Keep the most recent current_story
  if (incoming.current_story !== undefined) {
    merged.current_story = incoming.current_story;
  }

  return merged;
}
