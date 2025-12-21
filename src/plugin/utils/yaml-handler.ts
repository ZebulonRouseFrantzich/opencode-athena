/**
 * YAML file handler for sprint-status.yaml
 *
 * Provides read/write utilities with error handling.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { SprintStatus } from "../../shared/types.js";

/**
 * Read and parse a YAML file
 *
 * @param filePath - Path to the YAML file
 * @returns Parsed content or null if file doesn't exist or parse fails
 */
export async function readYamlFile<T = unknown>(
  filePath: string
): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return parseYaml(content) as T;
  } catch (error) {
    console.warn(`[Athena] Failed to parse YAML file ${filePath}:`, error);
    return null;
  }
}

/**
 * Write data to a YAML file
 *
 * @param filePath - Path to the YAML file
 * @param data - Data to write
 */
export async function writeYamlFile<T = unknown>(
  filePath: string,
  data: T
): Promise<void> {
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
export async function readSprintStatus(
  filePath: string
): Promise<SprintStatus | null> {
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
 * Write sprint status to YAML file
 *
 * @param filePath - Path to sprint-status.yaml
 * @param status - SprintStatus object to write
 */
export async function writeSprintStatus(
  filePath: string,
  status: SprintStatus
): Promise<void> {
  // Update last_modified timestamp
  status.last_modified = new Date().toISOString();
  await writeYamlFile(filePath, status);
}
