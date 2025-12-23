import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Current version of OpenCode Athena
 * Updated during release process
 */
export const VERSION = "0.0.1";

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

  /** Athena state file (for story tracking) */
  stateFile: join(homedir(), ".config", "opencode", "athena-state.json"),
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
