/**
 * Prerequisites checker
 *
 * Validates that required dependencies and versions are available.
 */

import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import { CONFIG_PATHS, MIN_VERSIONS } from "../../shared/constants.js";
import type { Prerequisites } from "../../shared/types.js";

const execAsync = promisify(exec);

/**
 * Parse a semantic version string into components
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  if (!parsedA || !parsedB) return 0;

  if (parsedA.major !== parsedB.major) {
    return parsedA.major < parsedB.major ? -1 : 1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor < parsedB.minor ? -1 : 1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch < parsedB.patch ? -1 : 1;
  }
  return 0;
}

/**
 * Check Node.js version
 */
async function checkNode(): Promise<Prerequisites["node"]> {
  try {
    const { stdout } = await execAsync("node --version");
    const version = stdout.trim().replace(/^v/, "");
    const compatible = compareVersions(version, MIN_VERSIONS.node) >= 0;
    return { installed: true, version, compatible };
  } catch {
    return { installed: false, compatible: false };
  }
}

/**
 * Check OpenCode installation and version
 */
async function checkOpenCode(): Promise<Prerequisites["opencode"]> {
  try {
    const { stdout } = await execAsync("opencode --version");
    const version = stdout.trim();
    const compatible = compareVersions(version, MIN_VERSIONS.opencode) >= 0;
    return { installed: true, version, compatible };
  } catch {
    return { installed: false, compatible: false };
  }
}

/**
 * Check existing Athena installation
 */
async function checkAthena(): Promise<Prerequisites["athena"]> {
  if (!existsSync(CONFIG_PATHS.globalAthenaConfig)) {
    return { installed: false };
  }

  try {
    const content = readFileSync(CONFIG_PATHS.globalAthenaConfig, "utf-8");
    const config = JSON.parse(content);
    return {
      installed: true,
      version: config.version,
    };
  } catch {
    return { installed: true };
  }
}

/**
 * Check all prerequisites
 */
export async function checkPrerequisites(): Promise<Prerequisites> {
  const [node, opencode, athena] = await Promise.all([checkNode(), checkOpenCode(), checkAthena()]);

  return { node, opencode, athena };
}

/**
 * Check if oh-my-opencode is installed
 */
export async function checkOhMyOpenCode(): Promise<{ installed: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync("npm list oh-my-opencode --json", {
      cwd: CONFIG_PATHS.globalConfigDir,
    });
    const data = JSON.parse(stdout);
    const version = data.dependencies?.["oh-my-opencode"]?.version;
    return { installed: !!version, version };
  } catch {
    return { installed: false };
  }
}

/**
 * Get installed plugin versions from OpenCode config directory
 */
export async function getInstalledPlugins(): Promise<Record<string, string>> {
  try {
    const { stdout } = await execAsync("npm list --depth=0 --json", {
      cwd: CONFIG_PATHS.globalConfigDir,
    });
    const data = JSON.parse(stdout);
    const deps = data.dependencies || {};
    const result: Record<string, string> = {};
    for (const [name, info] of Object.entries(deps)) {
      result[name] = (info as { version?: string }).version || "unknown";
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Check if a specific npm package is outdated
 */
export async function checkPackageUpdate(
  packageName: string
): Promise<{ current?: string; latest?: string; updateAvailable: boolean }> {
  try {
    const { stdout } = await execAsync(`npm outdated ${packageName} --json`, {
      cwd: CONFIG_PATHS.globalConfigDir,
    });
    const data = JSON.parse(stdout);
    const info = data[packageName];
    if (info) {
      return {
        current: info.current,
        latest: info.latest,
        updateAvailable: info.current !== info.latest,
      };
    }
    return { updateAvailable: false };
  } catch {
    // npm outdated returns exit code 1 if packages are outdated
    // Try to parse the output anyway
    return { updateAvailable: false };
  }
}

/**
 * Validate that a config file is valid JSON
 */
export function validateJsonFile(path: string): { valid: boolean; error?: string } {
  if (!existsSync(path)) {
    return { valid: false, error: "File does not exist" };
  }

  try {
    const content = readFileSync(path, "utf-8");
    JSON.parse(content);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
  }
}
