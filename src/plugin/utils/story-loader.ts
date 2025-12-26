/**
 * Story loader utilities with flexible naming support.
 *
 * Supports multiple story naming conventions:
 * - story-{epic}-{number}.md (e.g., story-4-1.md) - BMAD standard
 * - story-{epic}-{number}-{title}.md (e.g., story-4-1-setup.md) - BMAD with title
 * - {epic}-{number}.md (e.g., 4-1.md) - minimal
 * - {epic}-{number}-{title}.md (e.g., 4-1-fastify-setup.md) - with title
 *
 * All matching is case-insensitive.
 * Files with "story-" prefix are prioritized over those without.
 */

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Result of finding a story file.
 */
export interface StoryFileResult {
  /** Full path to the story file */
  path: string;
  /** Original filename as it exists on disk */
  filename: string;
  /** Normalized story ID (e.g., "4.1") */
  storyId: string;
  /** Whether multiple matches were found */
  hasMultipleMatches: boolean;
  /** Other matching files that were not selected */
  alternativeFiles?: string[];
}

/**
 * Information about a story found in a directory.
 */
export interface StoryInfo {
  /** Normalized story ID (e.g., "4.1") */
  id: string;
  /** Epic number */
  epic: string;
  /** Story number within the epic */
  number: string;
  /** Original filename */
  filename: string;
  /** Full path to the file */
  path: string;
  /** Whether this file has the story- prefix */
  hasStoryPrefix: boolean;
}

/**
 * Pattern for matching story files.
 * Matches: story-4-1.md, story-4-1-title.md, 4-1.md, 4-1-title.md
 * Groups: [1] = "story-" prefix (optional), [2] = epic, [3] = number
 */
const STORY_PATTERN = /^(story-)?(\d+)-(\d+)(?:-[a-zA-Z0-9-]+)?\.md$/i;

/**
 * Parse a story ID from a filename.
 * Returns null if the filename doesn't match a story pattern.
 *
 * @example
 * parseStoryIdFromFilename("story-4-1.md") // { id: "4.1", epic: "4", number: "1", hasStoryPrefix: true }
 * parseStoryIdFromFilename("4-1-setup.md") // { id: "4.1", epic: "4", number: "1", hasStoryPrefix: false }
 * parseStoryIdFromFilename("README.md") // null
 */
export function parseStoryIdFromFilename(
  filename: string
): { id: string; epic: string; number: string; hasStoryPrefix: boolean } | null {
  const match = filename.match(STORY_PATTERN);
  if (!match) {
    return null;
  }

  const hasStoryPrefix = !!match[1];
  const epic = match[2];
  const number = match[3];

  return {
    id: `${epic}.${number}`,
    epic,
    number,
    hasStoryPrefix,
  };
}

/**
 * Find a story file by its ID (e.g., "4.1" or "4-1").
 * Searches the directory for any file matching the story pattern.
 *
 * Priority:
 * 1. Files with "story-" prefix
 * 2. Files without prefix
 *
 * If multiple matches exist, selects the highest priority and logs alternatives.
 *
 * @param storiesDir - Directory containing story files
 * @param storyId - Story ID (e.g., "4.1", "4-1", or "story-4-1")
 * @param logger - Optional logger for warnings about multiple matches
 * @returns StoryFileResult or null if not found
 */
export async function findStoryFile(
  storiesDir: string,
  storyId: string,
  logger?: { warn: (msg: string) => void }
): Promise<StoryFileResult | null> {
  if (!existsSync(storiesDir)) {
    return null;
  }

  // Normalize the story ID: "story-4-1" -> "4.1", "4-1" -> "4.1", "4.1" -> "4.1"
  const normalizedId = normalizeStoryId(storyId);
  const [epicNum, storyNum] = normalizedId.split(".");

  if (!epicNum || !storyNum) {
    return null;
  }

  const files = await readdir(storiesDir);
  const matches: StoryInfo[] = [];

  for (const file of files) {
    const parsed = parseStoryIdFromFilename(file);
    if (parsed && parsed.epic === epicNum && parsed.number === storyNum) {
      matches.push({
        ...parsed,
        filename: file,
        path: join(storiesDir, file),
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Sort: story- prefix first, then alphabetically
  matches.sort((a, b) => {
    if (a.hasStoryPrefix !== b.hasStoryPrefix) {
      return a.hasStoryPrefix ? -1 : 1;
    }
    return a.filename.localeCompare(b.filename);
  });

  const selected = matches[0];
  const alternatives = matches.slice(1).map((m) => m.filename);

  if (alternatives.length > 0 && logger) {
    const reason = selected.hasStoryPrefix ? "has story- prefix" : "alphabetically first";
    const altLines = alternatives.map((f) => `  → ${f}`).join("\n");
    logger.warn(
      `Multiple story files found for ${normalizedId}:\n  → ${selected.filename} (selected - ${reason})\n${altLines}`
    );
  }

  return {
    path: selected.path,
    filename: selected.filename,
    storyId: normalizedId,
    hasMultipleMatches: alternatives.length > 0,
    alternativeFiles: alternatives.length > 0 ? alternatives : undefined,
  };
}

/**
 * Find all stories for a given epic.
 * Returns stories sorted by story number.
 *
 * For duplicate story IDs (same epic-number but different filenames),
 * prioritizes files with "story-" prefix and logs alternatives.
 *
 * @param storiesDir - Directory containing story files
 * @param epicNumber - Epic number (e.g., "4" or "epic-4")
 * @param logger - Optional logger for warnings about duplicates
 * @returns Array of StoryInfo objects
 */
export async function findStoriesForEpic(
  storiesDir: string,
  epicNumber: string,
  logger?: { warn: (msg: string) => void }
): Promise<StoryInfo[]> {
  if (!existsSync(storiesDir)) {
    return [];
  }

  // Normalize: "epic-4" -> "4"
  const epicNum = epicNumber.replace(/^epic-/i, "");

  const files = await readdir(storiesDir);
  const allMatches: StoryInfo[] = [];

  for (const file of files) {
    const parsed = parseStoryIdFromFilename(file);
    if (parsed && parsed.epic === epicNum) {
      allMatches.push({
        ...parsed,
        filename: file,
        path: join(storiesDir, file),
      });
    }
  }

  // Group by story ID to handle duplicates
  const byId = new Map<string, StoryInfo[]>();
  for (const match of allMatches) {
    const existing = byId.get(match.id) || [];
    existing.push(match);
    byId.set(match.id, existing);
  }

  // Select best match for each story ID
  const results: StoryInfo[] = [];
  for (const [id, matches] of byId) {
    // Sort: story- prefix first, then alphabetically
    matches.sort((a, b) => {
      if (a.hasStoryPrefix !== b.hasStoryPrefix) {
        return a.hasStoryPrefix ? -1 : 1;
      }
      return a.filename.localeCompare(b.filename);
    });

    const selected = matches[0];
    results.push(selected);

    if (matches.length > 1 && logger) {
      const alternatives = matches.slice(1).map((m) => m.filename);
      const reason = selected.hasStoryPrefix ? "has story- prefix" : "alphabetically first";
      const altLines = alternatives.map((f) => `  → ${f}`).join("\n");
      logger.warn(
        `Multiple story files found for ${id}:\n  → ${selected.filename} (selected - ${reason})\n${altLines}`
      );
    }
  }

  // Sort by story number
  return results.sort((a, b) => {
    const numA = Number.parseInt(a.number, 10);
    const numB = Number.parseInt(b.number, 10);
    return numA - numB;
  });
}

/**
 * Load story file content by ID.
 * Convenience function that combines findStoryFile + readFile.
 *
 * @param storiesDir - Directory containing story files
 * @param storyId - Story ID (e.g., "4.1")
 * @param logger - Optional logger for warnings
 * @returns File content or null if not found
 */
export async function loadStoryContent(
  storiesDir: string,
  storyId: string,
  logger?: { warn: (msg: string) => void }
): Promise<{ content: string; path: string; filename: string } | null> {
  const result = await findStoryFile(storiesDir, storyId, logger);
  if (!result) {
    return null;
  }

  try {
    const content = await readFile(result.path, "utf-8");
    return {
      content,
      path: result.path,
      filename: result.filename,
    };
  } catch {
    return null;
  }
}

/**
 * Normalize a story ID to the format "epic.number".
 *
 * @example
 * normalizeStoryId("story-4-1") // "4.1"
 * normalizeStoryId("4-1") // "4.1"
 * normalizeStoryId("4.1") // "4.1"
 * normalizeStoryId("story-4-1-title.md") // "4.1"
 */
export function normalizeStoryId(identifier: string): string {
  // Handle file paths
  if (identifier.includes("/")) {
    const filename = identifier.split("/").pop() || "";
    const parsed = parseStoryIdFromFilename(filename);
    if (parsed) {
      return parsed.id;
    }
  }

  // Handle filenames directly
  if (identifier.endsWith(".md")) {
    const parsed = parseStoryIdFromFilename(identifier);
    if (parsed) {
      return parsed.id;
    }
  }

  // Handle "story-4-1" or "4-1" format
  const cleaned = identifier.replace(/^story-/i, "");

  // Convert "4-1" to "4.1"
  if (cleaned.includes("-") && !cleaned.includes(".")) {
    const parts = cleaned.split("-");
    if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
      return `${parts[0]}.${parts[1]}`;
    }
  }

  return cleaned;
}

/**
 * Check if a filename matches a story pattern.
 * Used for filtering directory listings.
 */
export function isStoryFile(filename: string): boolean {
  return STORY_PATTERN.test(filename);
}

/**
 * Get the expected filename patterns for a story ID.
 * Useful for error messages.
 *
 * @param storyId - Normalized story ID (e.g., "4.1")
 * @returns Array of example patterns
 */
export function getStoryFilenamePatterns(storyId: string): string[] {
  const [epic, number] = storyId.split(".");
  return [
    `story-${epic}-${number}.md`,
    `story-${epic}-${number}-*.md`,
    `${epic}-${number}.md`,
    `${epic}-${number}-*.md`,
  ];
}
