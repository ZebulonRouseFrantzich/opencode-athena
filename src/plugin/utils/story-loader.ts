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
import { basename, join, resolve } from "node:path";

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
 * Extract story ID from a finding ID.
 *
 * Handles multiple formats from different sources:
 * - story-{epic}-{num}-*: "story-2-3-high-1" → "2.3" (test/legacy format)
 * - S{storyId}-*: "S2.3-SEC-1" → "2.3" (Oracle storyFindings format)
 * - {storyId}-*: "4.5-L1" → "4.5" (direct story prefix)
 * - {epic}-{num}-*: "2-3-high-1" → "2.3" (dash-separated)
 *
 * Falls back to provided default for IDs without story info:
 * - "high-1", "debate-3", "SEC-1" → uses fallback
 *
 * @param findingId - The finding ID to parse
 * @param fallback - Default story ID if not extractable (typically session identifier)
 * @returns Normalized story ID (e.g., "4.5")
 */
export function extractStoryIdFromFindingId(findingId: string, fallback: string): string {
  // Pattern 1: story-{epic}-{num}-* (legacy/test format)
  // e.g., "story-2-3-high-1" → "2.3"
  const storyPrefixMatch = findingId.match(/^story-?(\d+)[.-](\d+[a-z]?)/i);
  if (storyPrefixMatch) {
    return `${storyPrefixMatch[1]}.${storyPrefixMatch[2]}`;
  }

  // Pattern 2: S{storyId}-* (Oracle storyFindings format)
  // e.g., "S2.3-SEC-1" → "2.3", "S4.5a-LOG-1" → "4.5a"
  const oracleMatch = findingId.match(/^S(\d+)[.](\d+[a-z]?)-/i);
  if (oracleMatch) {
    return `${oracleMatch[1]}.${oracleMatch[2]}`;
  }

  // Pattern 3: {storyId}-* (direct story ID prefix with dot)
  // e.g., "4.5-L1" → "4.5", "2.3a-P1" → "2.3a"
  const dotMatch = findingId.match(/^(\d+)[.](\d+[a-z]?)-/);
  if (dotMatch) {
    return `${dotMatch[1]}.${dotMatch[2]}`;
  }

  // Pattern 4: {epic}-{num}-* (dash-separated, no "story" prefix)
  // e.g., "2-3-high-1" → "2.3"
  // Must have something after the second number to distinguish from story IDs
  const dashMatch = findingId.match(/^(\d+)-(\d+[a-z]?)-[a-zA-Z]/);
  if (dashMatch) {
    return `${dashMatch[1]}.${dashMatch[2]}`;
  }

  // No story ID found in finding ID - use fallback
  // This handles: "high-1", "debate-3", "SEC-1", "LOG-2", etc.
  return normalizeStoryId(fallback);
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

/**
 * Strip @ prefix if present (OpenCode file reference syntax).
 * OpenCode uses @path/to/file to reference files in prompts.
 *
 * @example
 * stripAtPrefix("@docs/stories/story-4-1.md") // "docs/stories/story-4-1.md"
 * stripAtPrefix("4.1") // "4.1"
 * stripAtPrefix("story-4-1") // "story-4-1"
 */
export function stripAtPrefix(identifier: string): string {
  return identifier.startsWith("@") ? identifier.slice(1) : identifier;
}

/**
 * Check if identifier looks like a file path (vs a story ID).
 * Does NOT check if file exists - just pattern detection.
 *
 * @example
 * looksLikeFilePath("docs/stories/story-4-1.md") // true
 * looksLikeFilePath("./story-4-1.md") // true
 * looksLikeFilePath("/absolute/path/story.md") // true
 * looksLikeFilePath("4.1") // false
 * looksLikeFilePath("story-4-1") // false
 */
export function looksLikeFilePath(identifier: string): boolean {
  // Contains path separator (forward or back slash)
  const hasPathSeparator = identifier.includes("/") || identifier.includes("\\");

  // Ends with .md extension
  const hasMdExtension = identifier.endsWith(".md");

  // Starts with ./ or ../ (relative path indicators)
  const hasRelativePrefix = identifier.startsWith("./") || identifier.startsWith("../");

  // Starts with / (absolute path on Unix)
  const hasAbsolutePrefix = identifier.startsWith("/");

  // It's a file path if it has path separators, or has .md extension with relative/absolute prefix
  return hasPathSeparator || (hasMdExtension && (hasRelativePrefix || hasAbsolutePrefix));
}

/**
 * Load story content directly from a file path.
 * Extracts story ID from filename for tracking.
 *
 * @param filePath - Absolute or resolved path to the story file
 * @returns Story content with metadata, or null if file doesn't exist
 */
export async function loadStoryFromPath(
  filePath: string
): Promise<{ content: string; path: string; filename: string; storyId: string } | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  const filename = basename(filePath);
  const parsed = parseStoryIdFromFilename(filename);

  // Extract story ID from filename, or normalize the filename itself
  const storyId = parsed?.id ?? normalizeStoryId(filename);

  try {
    const content = await readFile(filePath, "utf-8");
    return { content, path: filePath, filename, storyId };
  } catch {
    return null;
  }
}

/**
 * Result of resolving a story identifier.
 */
export interface ResolvedStory {
  /** Story file content */
  content: string;
  /** Full path to the story file */
  path: string;
  /** Original filename */
  filename: string;
  /** Normalized story ID (e.g., "4.1") */
  storyId: string;
}

/**
 * Resolve a story identifier that might be a file path or story ID.
 *
 * Resolution order:
 * 1. Strip @ prefix if present (OpenCode file reference syntax)
 * 2. If it looks like a file path:
 *    a. Try as absolute path
 *    b. Try relative to projectRoot
 * 3. Fall back to searching in storiesDir (original behavior)
 *
 * @param storiesDir - Directory containing story files (for fallback)
 * @param identifier - Story ID (e.g., "4.1") or file path (e.g., "docs/stories/story-4-1.md")
 * @param projectRoot - Project root for resolving relative paths
 * @param logger - Optional logger for warnings
 * @returns Resolved story or null if not found
 *
 * @example
 * // File path (absolute)
 * await resolveStoryIdentifier(storiesDir, "/home/user/project/docs/story-4-1.md", projectRoot)
 *
 * // File path (relative)
 * await resolveStoryIdentifier(storiesDir, "docs/stories/story-4-1.md", projectRoot)
 *
 * // OpenCode @ reference
 * await resolveStoryIdentifier(storiesDir, "@docs/stories/story-4-1.md", projectRoot)
 *
 * // Story ID (fallback to storiesDir search)
 * await resolveStoryIdentifier(storiesDir, "4.1", projectRoot)
 */
export async function resolveStoryIdentifier(
  storiesDir: string,
  identifier: string,
  projectRoot?: string,
  logger?: { warn: (msg: string) => void }
): Promise<ResolvedStory | null> {
  // 1. Strip @ prefix if present
  const cleaned = stripAtPrefix(identifier);

  // 2. Check if it looks like a file path
  if (looksLikeFilePath(cleaned)) {
    // 2a. Try as absolute path (or path that exists as-is)
    if (existsSync(cleaned)) {
      const result = await loadStoryFromPath(cleaned);
      if (result) return result;
    }

    // 2b. Try relative to project root
    if (projectRoot) {
      const absolutePath = resolve(projectRoot, cleaned);
      if (existsSync(absolutePath)) {
        const result = await loadStoryFromPath(absolutePath);
        if (result) return result;
      }
    }

    // File path was provided but doesn't exist - still try storiesDir as fallback
    // This handles cases where user provides "story-4-1.md" without full path
  }

  // 3. Fall back to storiesDir search (original behavior)
  const result = await loadStoryContent(storiesDir, cleaned, logger);
  if (result) {
    return {
      ...result,
      storyId: normalizeStoryId(cleaned),
    };
  }

  return null;
}
