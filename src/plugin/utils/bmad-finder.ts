import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fdir } from "fdir";
import { parse as parseYaml } from "yaml";
import { createPluginLogger } from "./plugin-logger.js";

const log = createPluginLogger("bmad-finder");

const BMAD_DIR_NAMES = ["docs", ".bmad", "bmad"] as const;

const KNOWN_MANIFEST_PATHS = [
  ".bmad/_cfg/agent-manifest.csv",
  ".bmad/config/agent-manifest.csv",
  "bmad/_cfg/agent-manifest.csv",
  "_bmad/_config/agent-manifest.csv",
] as const;

const KNOWN_AGENT_DIRS = [
  "_bmad/bmm/agents",
  "src/modules/bmm/agents",
  ".bmad/bmm/agents",
  "bmad/bmm/agents",
] as const;

const MANIFEST_SEARCH_EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".cache",
  ".turbo",
]);

const manifestCache = new Map<string, string | null>();
const agentFilesCache = new Map<string, string[]>();

const BMAD_V6_DEFAULTS = {
  planningArtifacts: "docs/project-planning-artifacts",
  implementationArtifacts: "docs/implementation-artifacts",
  projectKnowledge: "docs",
} as const;

const LEGACY_PATHS = {
  docsDir: "docs",
  storiesDir: "docs/stories",
  sprintArtifacts: "docs/sprint-artifacts",
} as const;

interface BmadConfig {
  planning_artifacts?: string;
  implementation_artifacts?: string;
  sprint_artifacts?: string;
  project_knowledge?: string;
  output_folder?: string;
}

interface BmadPaths {
  projectRoot: string;
  bmadDir: string | null;
  planningDir: string;
  implementationDir: string;
  storiesDir: string;
  sprintStatus: string;
  architecture: string;
  prd: string;
  epics: string;
}

export async function findBmadDir(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const visited = new Set<string>();

  while (currentDir && !visited.has(currentDir)) {
    visited.add(currentDir);

    for (const dirName of BMAD_DIR_NAMES) {
      const bmadPath = join(currentDir, dirName);
      if (existsSync(bmadPath)) {
        return bmadPath;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return null;
}

async function readBmadConfig(bmadDir: string): Promise<BmadConfig | null> {
  const configPath = join(bmadDir, "bmm", "config.yaml");
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    return parseYaml(content) as BmadConfig;
  } catch {
    return null;
  }
}

/**
 * Expand BMAD METHOD v6 placeholders in config paths.
 *
 * Strips {project-root}/ prefix to create relative paths that can be
 * joined with projectRoot. This handles the standard BMAD v6 placeholder
 * that is preserved during installation for runtime resolution.
 *
 * @param path - Path that may contain {project-root} placeholder
 * @returns Relative path with placeholder stripped, or undefined if input is undefined
 *
 * @example
 * expandBmadPlaceholder("{project-root}/docs/sprint-artifacts") // → "docs/sprint-artifacts"
 * expandBmadPlaceholder("docs/sprint-artifacts") // → "docs/sprint-artifacts"
 * expandBmadPlaceholder(undefined) // → undefined
 */
function expandBmadPlaceholder(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return path.replace(/^\{project-root\}\/?/, "");
}

/**
 * Check if a directory contains story files.
 * Looks for files matching story naming patterns: 1-1.md, 2-3.md, story-2-3.md, etc.
 */
async function hasStoryFiles(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return false;

  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(dir);
    // Match story naming: 1-1.md, 2-3.md, story-2-3.md, etc.
    return files.some((f) => f.endsWith(".md") && /^(\d+-\d+|story-\d+-\d+)/.test(f));
  } catch {
    return false;
  }
}

/**
 * Detect stories directory by checking nested vs flat structure.
 * Tries nested path first (BMAD v6 standard), then flat structure, then legacy paths.
 */
async function detectStoriesDir(baseDir: string, projectRoot: string): Promise<string> {
  const nestedPath = join(baseDir, "stories");
  if (await hasStoryFiles(nestedPath)) {
    return nestedPath;
  }

  if (await hasStoryFiles(baseDir)) {
    return baseDir;
  }

  const legacySprintArtifacts = join(projectRoot, LEGACY_PATHS.sprintArtifacts);
  if (await hasStoryFiles(legacySprintArtifacts)) {
    return legacySprintArtifacts;
  }

  const legacyStoriesDir = join(projectRoot, LEGACY_PATHS.storiesDir);
  if (await hasStoryFiles(legacyStoriesDir)) {
    return legacyStoriesDir;
  }

  return nestedPath;
}

/**
 * Generate case variants for a filename.
 * For example, "PRD.md" → ["PRD.md", "prd.md", "Prd.md"]
 */
function getCaseVariants(filename: string): string[] {
  const variants = new Set<string>();
  const [name, ext] = filename.split(".");

  variants.add(filename);
  variants.add(filename.toLowerCase());
  variants.add(filename.toUpperCase());

  if (name) {
    const firstCap = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    variants.add(ext ? `${firstCap}.${ext}` : firstCap);
  }

  return Array.from(variants);
}

/**
 * Search for a file with case-insensitive matching.
 * Tries exact match first, then case variants.
 */
function searchForFileWithVariants(
  projectRoot: string,
  filename: string,
  searchPaths: string[]
): string {
  const variants = getCaseVariants(filename);

  for (const searchPath of searchPaths) {
    for (const variant of variants) {
      const fullPath = join(projectRoot, searchPath, variant);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return join(projectRoot, searchPaths[0], filename);
}

export async function getBmadPaths(
  startDir: string,
  athenaConfig?: {
    bmad?: {
      paths?: {
        stories?: string | null;
        sprintStatus?: string | null;
        prd?: string | null;
        architecture?: string | null;
        epics?: string | null;
      };
    };
  }
): Promise<BmadPaths> {
  const bmadDir = await findBmadDir(startDir);
  const projectRoot = bmadDir ? dirname(bmadDir) : startDir;

  let config: BmadConfig | null = null;
  if (bmadDir) {
    config = await readBmadConfig(bmadDir);
  }

  const planningDir = join(
    projectRoot,
    expandBmadPlaceholder(config?.planning_artifacts) ?? BMAD_V6_DEFAULTS.planningArtifacts
  );

  const implementationDir = join(
    projectRoot,
    expandBmadPlaceholder(config?.implementation_artifacts) ??
      expandBmadPlaceholder(config?.sprint_artifacts) ??
      BMAD_V6_DEFAULTS.implementationArtifacts
  );

  const storiesDir = athenaConfig?.bmad?.paths?.stories
    ? join(projectRoot, athenaConfig.bmad.paths.stories)
    : await detectStoriesDir(implementationDir, projectRoot);

  const sprintStatusSearchPaths = [
    expandBmadPlaceholder(config?.implementation_artifacts) ||
      BMAD_V6_DEFAULTS.implementationArtifacts,
    expandBmadPlaceholder(config?.sprint_artifacts) || "docs/sprint-artifacts",
    LEGACY_PATHS.sprintArtifacts,
    LEGACY_PATHS.docsDir,
  ];
  const sprintStatus = athenaConfig?.bmad?.paths?.sprintStatus
    ? join(projectRoot, athenaConfig.bmad.paths.sprintStatus)
    : searchForFileWithVariants(projectRoot, "sprint-status.yaml", sprintStatusSearchPaths);

  const architectureSearchPaths = [
    expandBmadPlaceholder(config?.planning_artifacts) || BMAD_V6_DEFAULTS.planningArtifacts,
    LEGACY_PATHS.docsDir,
  ];
  const architecture = athenaConfig?.bmad?.paths?.architecture
    ? join(projectRoot, athenaConfig.bmad.paths.architecture)
    : searchForFileWithVariants(projectRoot, "architecture.md", architectureSearchPaths);

  const prdSearchPaths = [
    expandBmadPlaceholder(config?.planning_artifacts) || BMAD_V6_DEFAULTS.planningArtifacts,
    LEGACY_PATHS.docsDir,
  ];
  const prd = athenaConfig?.bmad?.paths?.prd
    ? join(projectRoot, athenaConfig.bmad.paths.prd)
    : searchForFileWithVariants(projectRoot, "PRD.md", prdSearchPaths);

  const epicsSearchPaths = [
    expandBmadPlaceholder(config?.planning_artifacts) || BMAD_V6_DEFAULTS.planningArtifacts,
    LEGACY_PATHS.docsDir,
  ];
  const epics = athenaConfig?.bmad?.paths?.epics
    ? join(projectRoot, athenaConfig.bmad.paths.epics)
    : searchForFileWithVariants(projectRoot, "epics.md", epicsSearchPaths);

  return {
    projectRoot,
    bmadDir,
    planningDir,
    implementationDir,
    storiesDir,
    sprintStatus,
    architecture,
    prd,
    epics,
  };
}

export async function findManifest(projectRoot: string): Promise<string | null> {
  const cached = manifestCache.get(projectRoot);
  if (cached !== undefined) {
    return cached;
  }

  for (const knownPath of KNOWN_MANIFEST_PATHS) {
    const fullPath = join(projectRoot, knownPath);
    if (existsSync(fullPath)) {
      manifestCache.set(projectRoot, fullPath);
      return fullPath;
    }
  }

  const bmadDir = await findBmadDir(projectRoot);
  if (bmadDir) {
    try {
      const files = await new fdir()
        .withMaxDepth(3)
        .withBasePath()
        .exclude((dirName) => MANIFEST_SEARCH_EXCLUDE_DIRS.has(dirName))
        .filter((path) => path.endsWith("agent-manifest.csv"))
        .crawl(bmadDir)
        .withPromise();

      if (files.length > 0) {
        manifestCache.set(projectRoot, files[0]);
        return files[0];
      }
    } catch (error) {
      log.warn("Failed to search for manifest in BMAD directory", {
        bmadDir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const projectFiles = await new fdir()
      .withMaxDepth(5)
      .withBasePath()
      .exclude((dirName) => MANIFEST_SEARCH_EXCLUDE_DIRS.has(dirName))
      .filter((path) => path.endsWith("agent-manifest.csv"))
      .crawl(projectRoot)
      .withPromise();

    const result = projectFiles.length > 0 ? projectFiles[0] : null;
    manifestCache.set(projectRoot, result);
    return result;
  } catch (error) {
    log.warn("Failed to search for manifest in project root", {
      projectRoot,
      error: error instanceof Error ? error.message : String(error),
    });
    manifestCache.set(projectRoot, null);
    return null;
  }
}

export function clearManifestCache(): void {
  manifestCache.clear();
}

export async function findAgentFiles(projectRoot: string): Promise<string[]> {
  const cached = agentFilesCache.get(projectRoot);
  if (cached !== undefined) {
    return cached;
  }

  for (const knownDir of KNOWN_AGENT_DIRS) {
    const fullPath = join(projectRoot, knownDir);
    if (existsSync(fullPath)) {
      try {
        const files = await new fdir()
          .withBasePath()
          .filter((path) => path.endsWith(".agent.yaml"))
          .crawl(fullPath)
          .withPromise();

        if (files.length > 0) {
          agentFilesCache.set(projectRoot, files);
          return files;
        }
      } catch (error) {
        log.warn("Failed to search for agent files in known directory", {
          directory: fullPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const bmadDir = await findBmadDir(projectRoot);
  if (bmadDir) {
    try {
      const files = await new fdir()
        .withMaxDepth(5)
        .withBasePath()
        .exclude((dirName) => MANIFEST_SEARCH_EXCLUDE_DIRS.has(dirName))
        .filter((path) => path.endsWith(".agent.yaml"))
        .crawl(bmadDir)
        .withPromise();

      if (files.length > 0) {
        agentFilesCache.set(projectRoot, files);
        return files;
      }
    } catch (error) {
      log.warn("Failed to search for agent files in BMAD directory", {
        bmadDir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const projectFiles = await new fdir()
      .withMaxDepth(6)
      .withBasePath()
      .exclude((dirName) => MANIFEST_SEARCH_EXCLUDE_DIRS.has(dirName))
      .filter((path) => path.endsWith(".agent.yaml") && path.includes("/agents/"))
      .crawl(projectRoot)
      .withPromise();

    agentFilesCache.set(projectRoot, projectFiles);
    return projectFiles;
  } catch (error) {
    log.warn("Failed to search for agent files in project root", {
      projectRoot,
      error: error instanceof Error ? error.message : String(error),
    });
    agentFilesCache.set(projectRoot, []);
    return [];
  }
}

export function clearAgentFilesCache(): void {
  agentFilesCache.clear();
}
