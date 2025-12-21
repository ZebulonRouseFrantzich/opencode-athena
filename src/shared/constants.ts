import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Current version of OpenCode Athena
 * Updated during release process
 */
export const VERSION = "1.0.0";

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
  bmadDir: "_bmad",

  /** BMAD docs directory */
  bmadDocsDir: "_bmad/docs",

  /** Sprint status file */
  sprintStatus: "_bmad/docs/sprint-status.yaml",

  /** Stories directory */
  storiesDir: "_bmad/docs/stories",

  /** Architecture document */
  architecture: "_bmad/docs/architecture.md",

  /** PRD document */
  prd: "_bmad/docs/PRD.md",
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
