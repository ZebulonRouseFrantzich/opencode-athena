/**
 * BMAD directory finder
 *
 * Searches upward from the project directory to find BMAD installation.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** Possible BMAD directory names in order of preference */
const BMAD_DIR_NAMES = ["_bmad", ".bmad", "bmad"] as const;

/**
 * Find the BMAD directory by searching upward from the start directory.
 *
 * Searches for directories named: _bmad, .bmad, or bmad
 *
 * @param startDir - The directory to start searching from
 * @returns The path to the BMAD directory, or null if not found
 */
export async function findBmadDir(startDir: string): Promise<string | null> {
  let currentDir = startDir;

  // Prevent infinite loop by tracking visited directories
  const visited = new Set<string>();

  while (currentDir && !visited.has(currentDir)) {
    visited.add(currentDir);

    // Check for each possible BMAD directory name
    for (const dirName of BMAD_DIR_NAMES) {
      const bmadPath = join(currentDir, dirName);
      if (existsSync(bmadPath)) {
        return bmadPath;
      }
    }

    // Move up one directory
    const parentDir = dirname(currentDir);

    // Stop if we've reached the root
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return null;
}

/**
 * Get paths to common BMAD files relative to a BMAD directory
 */
export function getBmadPaths(bmadDir: string) {
  return {
    docsDir: join(bmadDir, "docs"),
    storiesDir: join(bmadDir, "docs", "stories"),
    sprintStatus: join(bmadDir, "docs", "sprint-status.yaml"),
    architecture: join(bmadDir, "docs", "architecture.md"),
    prd: join(bmadDir, "docs", "PRD.md"),
  };
}
