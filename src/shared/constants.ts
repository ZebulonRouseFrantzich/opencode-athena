import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Get version from package.json at runtime.
 * Handles both bundled (dist/) and development (src/) scenarios.
 */
function getPackageVersion(): string {
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));

    const possiblePaths = [
      join(currentDir, "..", "..", "package.json"),
      join(currentDir, "..", "..", "..", "package.json"),
    ];

    for (const pkgPath of possiblePaths) {
      if (!existsSync(pkgPath)) continue;

      const content = readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(content);
      if (pkg.version) return pkg.version;
    }

    return "0.0.0";
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("[opencode-athena] Warning: package.json contains invalid JSON");
    }
    return "0.0.0";
  }
}

/**
 * Current version of OpenCode Athena
 * Dynamically read from package.json
 */
export const VERSION = getPackageVersion();

/**
 * Package name for CLI display
 */
export const PACKAGE_NAME = "opencode-athena";

/**
 * CLI display name
 */
export const DISPLAY_NAME = "OpenCode Athena";

/**
 * Tagline for CLI header
 */
export const TAGLINE = "Strategic wisdom meets practical execution";

/**
 * Configuration paths
 */
export const CONFIG_PATHS = {
  /** Global OpenCode config directory */
  globalConfigDir: join(homedir(), ".config", "opencode"),

  /** Global Athena config file */
  globalAthenaConfig: join(homedir(), ".config", "opencode", "athena.json"),

  /** Global OpenCode config file */
  globalOpencodeConfig: join(homedir(), ".config", "opencode", "opencode.json"),

  /** Global oh-my-opencode config file */
  globalOmoConfig: join(homedir(), ".config", "opencode", "oh-my-opencode.json"),

  /** Commands directory */
  commandsDir: join(homedir(), ".config", "opencode", "command"),

  /** Plugin directory */
  pluginDir: join(homedir(), ".config", "opencode", "plugin"),

  /** Athena internal files directory (state, backups) */
  athenaDir: join(homedir(), ".config", "opencode", "athena"),

  /** Athena backups directory */
  backupsDir: join(homedir(), ".config", "opencode", "athena", "backups"),

  /** Athena state file (for story tracking) */
  stateFile: join(homedir(), ".config", "opencode", "athena", "athena-state.json"),

  /** Legacy state file path (for migration) */
  legacyStateFile: join(homedir(), ".config", "opencode", "athena-state.json"),
} as const;

/**
 * Project-specific paths (relative to project root)
 */
export const PROJECT_PATHS = {
  /** Local Athena config */
  localConfig: ".opencode/athena.json",

  /** BMAD directory */
  bmadDir: "docs",

  /** BMAD docs directory (deprecated - same as bmadDir in v6) */
  bmadDocsDir: "docs",

  /** Sprint status file */
  sprintStatus: "docs/implementation-artifacts/sprint-status.yaml",

  /** Stories directory */
  storiesDir: "docs/implementation-artifacts/stories",

  /** Architecture document */
  architecture: "docs/project-planning-artifacts/architecture.md",

  /** PRD document */
  prd: "docs/project-planning-artifacts/PRD.md",
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Default BMAD track for new projects */
  defaultTrack: "bmad-method" as const,

  /** Whether to auto-update sprint status */
  autoStatusUpdate: true,

  /** Maximum parallel stories */
  parallelStoryLimit: 3,

  /** Default features enabled */
  features: {
    bmadBridge: true,
    autoStatus: true,
    parallelExecution: true,
    notifications: true,
    contextMonitor: true,
    commentChecker: true,
    lspTools: true,
    autoGitOperations: false,
    todoSync: true,
  },

  /** Default MCPs enabled */
  mcps: {
    context7: true,
    exa: true,
    grepApp: true,
  },
} as const;

/**
 * Minimum compatible versions
 */
export const MIN_VERSIONS = {
  node: "20.0.0",
  opencode: "1.0.132",
} as const;
