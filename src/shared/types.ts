/**
 * Shared TypeScript type definitions for OpenCode Athena
 */

// ============================================================================
// CLI Types
// ============================================================================

/**
 * Options passed to the install command
 */
export interface InstallOptions {
  preset: string;
  yes: boolean;
  advanced: boolean;
  global: boolean;
  local: boolean;
}

/**
 * Options passed to the update command
 */
export interface UpdateOptions {
  check: boolean;
}

/**
 * Options passed to the doctor command
 */
export interface DoctorOptions {
  fix: boolean;
}

/**
 * Options passed to the uninstall command
 */
export interface UninstallOptions {
  keepConfig: boolean;
  keepDeps: boolean;
}

/**
 * Subscription information gathered during install
 */
export interface SubscriptionAnswers {
  hasClaude: boolean;
  claudeTier: "max5x" | "max20x" | "pro" | "none";
  hasOpenAI: boolean;
  hasGoogle: boolean;
  googleAuth: "antigravity" | "personal" | "api" | "none";
}

/**
 * Methodology preferences gathered during install
 */
export interface MethodologyAnswers {
  defaultTrack: "quick-flow" | "bmad-method" | "enterprise";
  autoStatusUpdate: boolean;
}

/**
 * Feature selections gathered during install
 */
export interface FeatureAnswers {
  enabledFeatures: string[];
  mcps: string[];
}

/**
 * Advanced options gathered during install
 */
export interface AdvancedAnswers {
  parallelStoryLimit?: number;
  experimental?: string[];
}

/**
 * Available model choices by provider
 */
export type LLMProvider = "anthropic" | "openai" | "google";

/**
 * Model definition
 */
export interface ModelChoice {
  id: string;
  name: string;
  provider: LLMProvider;
  description?: string;
}

/**
 * Agent roles that require model assignment
 */
export type AgentRole =
  | "sisyphus"
  | "oracle"
  | "librarian"
  | "frontend"
  | "documentWriter"
  | "multimodalLooker";

/**
 * Model assignments for each agent role
 */
export interface ModelAnswers {
  sisyphus: string;
  oracle: string;
  librarian: string;
  frontend?: string;
  documentWriter?: string;
  multimodalLooker?: string;
}

/**
 * All answers from the install wizard
 */
export interface InstallAnswers {
  subscriptions: SubscriptionAnswers;
  models: ModelAnswers;
  methodology: MethodologyAnswers;
  features: FeatureAnswers;
  advanced: AdvancedAnswers;
  installLocation: "global" | "local";
}

/**
 * A file to be generated/written by the installer
 */
export interface GeneratedFile {
  path: string;
  content: string;
  exists: boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Athena configuration file structure
 */
export interface AthenaConfig {
  $schema?: string;
  version: string;
  subscriptions: {
    claude: {
      enabled: boolean;
      tier: "max5x" | "max20x" | "pro" | "none";
    };
    openai: {
      enabled: boolean;
    };
    google: {
      enabled: boolean;
      authMethod: "antigravity" | "personal" | "api" | "none";
    };
  };
  models: {
    sisyphus: string;
    oracle: string;
    librarian: string;
    frontend?: string;
    documentWriter?: string;
    multimodalLooker?: string;
  };
  bmad: {
    defaultTrack: "quick-flow" | "bmad-method" | "enterprise";
    autoStatusUpdate: boolean;
    parallelStoryLimit: number;
  };
  features: {
    bmadBridge: boolean;
    autoStatus: boolean;
    parallelExecution: boolean;
    notifications: boolean;
    contextMonitor: boolean;
    commentChecker: boolean;
    lspTools: boolean;
  };
  mcps: {
    context7: boolean;
    exa: boolean;
    grepApp: boolean;
  };
}

/**
 * Prerequisites check result
 */
export interface Prerequisites {
  opencode: {
    installed: boolean;
    version?: string;
    compatible: boolean;
  };
  athena: {
    installed: boolean;
    version?: string;
  };
  node: {
    installed: boolean;
    version?: string;
    compatible: boolean;
  };
}

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Story status in sprint tracking
 */
export type StoryStatus = "pending" | "in_progress" | "completed" | "blocked" | "needs_review";

/**
 * Internal tracker status (includes transitional states)
 */
export type TrackerStatus = StoryStatus | "loading";

/**
 * Tracked story state
 */
export interface TrackedStory {
  id: string;
  content: string;
  status: TrackerStatus;
  startedAt: string;
  completedAt?: string;
}

/**
 * Sprint status structure (from sprint-status.yaml)
 */
export interface SprintStatus {
  sprint_number?: number;
  current_epic?: string;
  current_story?: string | null;
  completed_stories: string[];
  pending_stories: string[];
  in_progress_stories: string[];
  blocked_stories: string[];
  stories_needing_review?: string[];
  story_updates?: Record<
    string,
    {
      status: StoryStatus;
      updated_at: string;
      notes?: string;
      completion_summary?: string;
    }
  >;
  last_modified?: string;
}

/**
 * Story tracker persistent state
 */
export interface TrackerState {
  currentStory: TrackedStory | null;
  sessionId: string;
  projectDir: string;
  history: Array<{
    storyId: string;
    status: string;
    timestamp: string;
  }>;
}

// ============================================================================
// Tool Result Types
// ============================================================================

/**
 * Result from athena_get_story tool
 */
export interface GetStoryResult {
  storyId?: string;
  story?: string;
  architecture?: string;
  prd?: string;
  sprint?: {
    currentEpic: string;
    completedStories: number;
    pendingStories: number;
    blockedStories: number;
  };
  instructions?: string;
  error?: string;
  suggestion?: string;
  sprintProgress?: {
    completed: number;
    total: number;
  };
}

/**
 * Result from athena_update_status tool
 */
export interface UpdateStatusResult {
  success?: boolean;
  storyId?: string;
  newStatus?: StoryStatus;
  updatedAt?: string;
  sprintProgress?: {
    completed: number;
    inProgress: number;
    pending: number;
    blocked: number;
    total: number;
    percentComplete: number;
  };
  nextStory?: string | null;
  error?: string;
}
