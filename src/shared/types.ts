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
  hasGitHubCopilot: boolean;
  copilotPlan: "free" | "pro" | "pro-plus" | "business" | "enterprise" | "none";
  copilotEnabledModels?: string[];
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
export type LLMProvider = "anthropic" | "openai" | "google" | "github-copilot";

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
 * Custom model definition for user-added models
 */
export interface CustomModelDefinition {
  id: string;
  name: string;
  provider: LLMProvider;
  description?: string;
  capabilities?: {
    thinking?: boolean;
    contextWindow?: number;
    supportsTemperature?: boolean;
  };
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
 * Thinking level for reasoning-capable models
 */
export type ThinkingLevel = "off" | "low" | "medium" | "high";

/**
 * Agent-specific settings for temperature and thinking level
 */
export interface AgentSettings {
  temperature?: number; // 0.0 - 1.0
  thinkingLevel?: ThinkingLevel;
}

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
  settings?: {
    sisyphus?: AgentSettings;
    oracle?: AgentSettings;
    librarian?: AgentSettings;
    frontend?: AgentSettings;
    documentWriter?: AgentSettings;
    multimodalLooker?: AgentSettings;
    overrides?: Record<string, AgentSettings>; // Per-model overrides
  };
  custom?: CustomModelDefinition[];
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
    githubCopilot: {
      enabled: boolean;
      plan: "free" | "pro" | "pro-plus" | "business" | "enterprise" | "none";
      enabledModels?: string[];
    };
  };
  models: {
    sisyphus: string;
    oracle: string;
    librarian: string;
    frontend?: string;
    documentWriter?: string;
    multimodalLooker?: string;
    settings?: {
      sisyphus?: AgentSettings;
      oracle?: AgentSettings;
      librarian?: AgentSettings;
      frontend?: AgentSettings;
      documentWriter?: AgentSettings;
      multimodalLooker?: AgentSettings;
      overrides?: Record<string, AgentSettings>;
    };
    custom?: CustomModelDefinition[];
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

// ============================================================================
// Party Review Types
// ============================================================================

/**
 * Scope of a party review
 */
export type ReviewScope = "epic" | "story";

/**
 * Severity level of a review finding
 */
export type FindingSeverity = "high" | "medium" | "low";

/**
 * Category of a review finding
 */
export type FindingCategory = "security" | "logic" | "bestPractices" | "performance";

/**
 * User decision on a finding
 */
export type ReviewDecision = "accept" | "defer" | "reject" | "pending";

/**
 * A single party review finding
 */
export interface PartyReviewFinding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  impact: string;
  suggestion: string;
  storyId?: string;
  fileReference?: string;
  lineNumber?: number;
  decision?: ReviewDecision;
  decisionReason?: string;
  deferredTo?: string;
}

/**
 * Findings grouped by story
 */
export interface StoryFindings {
  storyId: string;
  title: string;
  filePath: string;
  findings: {
    security: PartyReviewFinding[];
    logic: PartyReviewFinding[];
    bestPractices: PartyReviewFinding[];
    performance: PartyReviewFinding[];
  };
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Cross-story issues found in epic reviews
 */
export interface CrossStoryIssue {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  affectedStories: string[];
  suggestion: string;
  decision?: ReviewDecision;
  decisionReason?: string;
}

/**
 * Model complexity assessment result
 */
export interface StoryComplexity {
  isSimple: boolean;
  reason: string;
  recommendedModel: string;
  factors: {
    acceptanceCriteriaCount: number;
    hasSecurityConcerns: boolean;
    hasDataModelChanges: boolean;
    hasApiChanges: boolean;
    isCrudOnly: boolean;
  };
}

/**
 * Reference to another review document
 */
export interface ReviewDocumentReference {
  type: "epic" | "focused";
  filePath: string;
  date: string;
  findingsCount: number;
  acceptedCount: number;
  deferredCount: number;
  rejectedCount: number;
}

/**
 * Complete party review document structure
 */
export interface PartyReviewDocument {
  scope: ReviewScope;
  identifier: string;
  date: string;
  reviewer: string;
  epicNumber?: string;
  storyId?: string;
  storiesReviewed?: string[];
  relatedReviews?: ReviewDocumentReference[];
  summary: {
    totalIssues: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    recommendation: string;
  };
  storyFindings?: StoryFindings[];
  crossStoryIssues?: CrossStoryIssue[];
  previousFindings?: {
    accepted: PartyReviewFinding[];
    deferred: PartyReviewFinding[];
    rejected: PartyReviewFinding[];
  };
  newFindings?: {
    security: PartyReviewFinding[];
    logic: PartyReviewFinding[];
    bestPractices: PartyReviewFinding[];
    performance: PartyReviewFinding[];
  };
  oracleAnalysis?: string;
}

/**
 * Result from athena_review_story tool (prepares context for Oracle invocation)
 */
export interface ReviewStoryResult {
  success: boolean;
  scope: ReviewScope;
  identifier: string;
  documentPath?: string;
  document?: PartyReviewDocument;
  error?: string;
  suggestion?: string;
  // Context prepared for command file to invoke Oracle
  oraclePrompt?: string;
  storiesContent?: Array<{ id: string; content: string | null }>;
  architectureContent?: string;
  existingReviews?: ReviewDocumentReference[];
  complexity?: StoryComplexity;
  selectedModel?: string;
  reviewsDir?: string;
}

/**
 * Argument for applying review decisions
 */
export interface ApplyReviewDecisionsArgs {
  documentPath: string;
  decisions: Record<string, ReviewDecision>;
  decisionReasons?: Record<string, string>;
  deferredTargets?: Record<string, string>;
}

/**
 * Result from applying review decisions
 */
export interface ApplyReviewDecisionsResult {
  success: boolean;
  updatedStories: string[];
  updatedDocuments: string[];
  summary: {
    accepted: number;
    deferred: number;
    rejected: number;
  };
  error?: string;
}

// ============================================================================
// Enhanced Party Review Types (3-Phase Architecture)
// ============================================================================

/**
 * BMAD agent types that can participate in party review
 */
export type BmadAgentType =
  | "architect"
  | "dev"
  | "tea"
  | "pm"
  | "analyst"
  | "ux-designer"
  | "tech-writer"
  | "sm";

/**
 * BMAD agent persona details
 */
export interface BmadAgentPersona {
  type: BmadAgentType;
  name: string;
  title: string;
  expertise: string[];
  perspective: string;
}

/**
 * Mapping of BMAD agents with their personas
 */
export const BMAD_AGENTS: Record<BmadAgentType, BmadAgentPersona> = {
  architect: {
    type: "architect",
    name: "Winston",
    title: "Software Architect",
    expertise: ["system design", "security architecture", "scalability", "technical debt"],
    perspective: "architecture and system design",
  },
  dev: {
    type: "dev",
    name: "Amelia",
    title: "Senior Developer",
    expertise: ["implementation", "code quality", "debugging", "performance optimization"],
    perspective: "implementation feasibility and code quality",
  },
  tea: {
    type: "tea",
    name: "Murat",
    title: "Test Engineer",
    expertise: ["testing strategy", "edge cases", "test automation", "quality assurance"],
    perspective: "testability and quality assurance",
  },
  pm: {
    type: "pm",
    name: "John",
    title: "Product Manager",
    expertise: ["requirements", "stakeholder needs", "prioritization", "business value"],
    perspective: "business impact and stakeholder value",
  },
  analyst: {
    type: "analyst",
    name: "Mary",
    title: "Business Analyst",
    expertise: ["requirements analysis", "user stories", "acceptance criteria", "edge cases"],
    perspective: "requirements completeness and clarity",
  },
  "ux-designer": {
    type: "ux-designer",
    name: "Sally",
    title: "UX Designer",
    expertise: ["user experience", "accessibility", "usability", "user flows"],
    perspective: "user experience and accessibility",
  },
  "tech-writer": {
    type: "tech-writer",
    name: "Paige",
    title: "Technical Writer",
    expertise: ["documentation", "API docs", "user guides", "clarity"],
    perspective: "documentation and clarity",
  },
  sm: {
    type: "sm",
    name: "Bob",
    title: "Scrum Master",
    expertise: ["process", "team dynamics", "sprint planning", "blockers"],
    perspective: "process and team coordination",
  },
};

/**
 * Agent recommendation with reasoning
 */
export interface AgentRecommendation {
  agent: BmadAgentType;
  reason: string;
  relevantFindings: string[];
  priority: "required" | "recommended" | "optional";
}

/**
 * Cross-story pattern identified by an agent
 */
export interface CrossStoryPattern {
  id: string;
  pattern: string;
  affectedStories: string[];
  severity: FindingSeverity;
  recommendation: string;
}

/**
 * Single agent's analysis output (Phase 2)
 */
export interface AgentAnalysis {
  agent: BmadAgentType;
  agentName: string;
  analyzedAt: string;
  storiesAnalyzed: string[];
  perspective: string;
  findings: {
    agreements: string[];
    concerns: string[];
    suggestions: string[];
  };
  crossStoryPatterns: CrossStoryPattern[];
  prioritizedIssues: Array<{
    findingId: string;
    agentPriority: "critical" | "important" | "minor";
    rationale: string;
  }>;
  summary: string;
}

/**
 * Phase 1 context: Prepared by tool for Oracle invocation (before Oracle runs)
 */
export type Phase1Context = Phase1ContextSuccess | Phase1ContextError;

export interface Phase1ContextSuccess {
  success: true;
  scope: ReviewScope;
  identifier: string;
  reviewsDir: string;
  storiesContent: Array<{ id: string; content: string | null }>;
  architectureContent: string;
  oraclePrompt: string;
  selectedModel: string;
  complexity?: StoryComplexity;
  existingReviews?: ReviewDocumentReference[];
}

export interface Phase1ContextError {
  success: false;
  scope: ReviewScope;
  identifier: string;
  error: string;
  suggestion?: string;
}

/**
 * Phase 1 result: Complete result after Oracle analysis with agent recommendations
 */
export interface Phase1Result {
  success: boolean;
  scope: ReviewScope;
  identifier: string;
  reviewDocumentPath: string;
  storiesContent: Array<{ id: string; title: string; content: string }>;
  architectureContent: string;
  findings: {
    total: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<FindingCategory, number>;
  };
  recommendedAgents: AgentRecommendation[];
  oracleAnalysis: string;
  error?: string;
  suggestion?: string;
}

/**
 * Phase 2 result: Aggregated agent analyses
 */
export interface Phase2Result {
  success: boolean;
  identifier: string;
  agentAnalyses: AgentAnalysis[];
  consensusPoints: string[];
  debatePoints: Array<{
    topic: string;
    positions: Array<{
      agent: BmadAgentType;
      position: string;
    }>;
  }>;
  aggregatedPriorities: Array<{
    findingId: string;
    votes: Record<BmadAgentType, "critical" | "important" | "minor" | "not-rated">;
    consensus: "strong" | "moderate" | "disputed";
  }>;
  error?: string;
}

/**
 * Discussion context for Phase 3 party mode
 */
export interface DiscussionContext {
  scope: ReviewScope;
  identifier: string;
  epicNumber?: string;
  storyIds: string[];
  phase1Summary: {
    totalFindings: number;
    highSeverity: number;
    reviewDocumentPath: string;
  };
  agentAnalyses: AgentAnalysis[];
  agendaItems: Array<{
    id: string;
    topic: string;
    type: "consensus" | "debate" | "decision-needed";
    relatedFindings: string[];
    agentPositions?: Record<BmadAgentType, string>;
  }>;
  preloadedContext: string;
}

/**
 * Final review session result
 */
export interface ReviewSessionResult {
  success: boolean;
  identifier: string;
  decisions: Record<string, ReviewDecision>;
  decisionSummary: {
    accepted: number;
    deferred: number;
    rejected: number;
    discussed: number;
  };
  storyUpdates: Array<{
    storyId: string;
    addedCriteria: string[];
    modifiedCriteria: string[];
  }>;
  actionItems: Array<{
    description: string;
    assignedTo?: BmadAgentType;
    deferredToStory?: string;
  }>;
  sessionNotes: string;
}
