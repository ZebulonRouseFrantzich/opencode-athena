import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fdir } from "fdir";
import { parse as parseYaml } from "yaml";

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

function searchForFile(projectRoot: string, filename: string, searchPaths: string[]): string {
  for (const searchPath of searchPaths) {
    const fullPath = join(projectRoot, searchPath, filename);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return join(projectRoot, searchPaths[0], filename);
}

export async function getBmadPaths(startDir: string): Promise<BmadPaths> {
  const bmadDir = await findBmadDir(startDir);
  const projectRoot = bmadDir ? dirname(bmadDir) : startDir;

  let config: BmadConfig | null = null;
  if (bmadDir) {
    config = await readBmadConfig(bmadDir);
  }

  const planningDir =
    config?.planning_artifacts || join(projectRoot, BMAD_V6_DEFAULTS.planningArtifacts);

  const implementationDir =
    config?.implementation_artifacts ||
    config?.sprint_artifacts ||
    join(projectRoot, BMAD_V6_DEFAULTS.implementationArtifacts);

  const storiesDir = join(implementationDir, "stories");

  const sprintStatusSearchPaths = [
    config?.implementation_artifacts || BMAD_V6_DEFAULTS.implementationArtifacts,
    config?.sprint_artifacts || "docs/sprint-artifacts",
    LEGACY_PATHS.sprintArtifacts,
    LEGACY_PATHS.docsDir,
  ];
  const sprintStatus = searchForFile(projectRoot, "sprint-status.yaml", sprintStatusSearchPaths);

  const architectureSearchPaths = [
    config?.planning_artifacts || BMAD_V6_DEFAULTS.planningArtifacts,
    LEGACY_PATHS.docsDir,
  ];
  const architecture = searchForFile(projectRoot, "architecture.md", architectureSearchPaths);

  const prdSearchPaths = [
    config?.planning_artifacts || BMAD_V6_DEFAULTS.planningArtifacts,
    LEGACY_PATHS.docsDir,
  ];
  const prd = searchForFile(projectRoot, "PRD.md", prdSearchPaths);

  const epicsSearchPaths = [
    config?.planning_artifacts || BMAD_V6_DEFAULTS.planningArtifacts,
    LEGACY_PATHS.docsDir,
  ];
  const epics = searchForFile(projectRoot, "epics.md", epicsSearchPaths);

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
  }

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
      const files = await new fdir()
        .withBasePath()
        .filter((path) => path.endsWith(".agent.yaml"))
        .crawl(fullPath)
        .withPromise();

      if (files.length > 0) {
        agentFilesCache.set(projectRoot, files);
        return files;
      }
    }
  }

  const bmadDir = await findBmadDir(projectRoot);
  if (bmadDir) {
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
  }

  const projectFiles = await new fdir()
    .withMaxDepth(6)
    .withBasePath()
    .exclude((dirName) => MANIFEST_SEARCH_EXCLUDE_DIRS.has(dirName))
    .filter((path) => path.endsWith(".agent.yaml") && path.includes("/agents/"))
    .crawl(projectRoot)
    .withPromise();

  agentFilesCache.set(projectRoot, projectFiles);
  return projectFiles;
}

export function clearAgentFilesCache(): void {
  agentFilesCache.clear();
}
