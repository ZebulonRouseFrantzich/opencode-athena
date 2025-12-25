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
  reconfigure?: boolean;
}

/**
 * Options passed to the upgrade command
 */
export interface UpgradeOptions {
  check: boolean;
  yes: boolean;
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
  | "multimodalLooker"
  | "explore";

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
  explore?: string;
  settings?: {
    sisyphus?: AgentSettings;
    oracle?: AgentSettings;
    librarian?: AgentSettings;
    frontend?: AgentSettings;
    documentWriter?: AgentSettings;
    multimodalLooker?: AgentSettings;
    explore?: AgentSettings;
    overrides?: Record<string, AgentSettings>;
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
      explore?: AgentSettings;
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
    autoGitOperations: boolean;
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

// ============================================================================
// Phase 3: Party Discussion Types
// ============================================================================

/**
 * Extended BMAD agent persona with full details from manifest
 */
export interface BmadAgentFullPersona extends BmadAgentPersona {
  icon: string;
  identity: string;
  communicationStyle: string;
  principles: string[];
  module?: string;
}

/**
 * Default full personas (fallback when BMAD manifest not available)
 */
export const BMAD_AGENT_FULL_PERSONAS: Record<BmadAgentType, BmadAgentFullPersona> = {
  architect: {
    type: "architect",
    name: "Winston",
    title: "Software Architect",
    icon: "🏗️",
    expertise: ["system design", "security architecture", "scalability", "technical debt"],
    perspective: "architecture and system design",
    identity:
      "Senior architect with expertise in distributed systems, cloud infrastructure, and API design. Specializes in scalable patterns and technology selection.",
    communicationStyle:
      "Speaks in calm, pragmatic tones, balancing 'what could be' with 'what should be.' Champions boring technology that actually works.",
    principles: [
      "User journeys drive technical decisions",
      "Embrace boring technology for stability",
      "Design simple solutions that scale when needed",
      "Developer productivity is architecture",
    ],
  },
  dev: {
    type: "dev",
    name: "Amelia",
    title: "Senior Developer",
    icon: "💻",
    expertise: ["implementation", "code quality", "debugging", "performance optimization"],
    perspective: "implementation feasibility and code quality",
    identity:
      "Elite developer who thrives on clean implementations. Lives for readable code, sensible abstractions, and solutions that actually work in production.",
    communicationStyle:
      "Ultra-succinct. Speaks in file paths and AC IDs - every statement citable. No fluff, all precision.",
    principles: [
      "Code should be readable by humans first",
      "Ship incrementally, validate continuously",
      "Tests are documentation",
      "Complexity is the enemy",
    ],
  },
  tea: {
    type: "tea",
    name: "Murat",
    title: "Test Engineer Advocate",
    icon: "🧪",
    expertise: ["testing strategy", "edge cases", "test automation", "quality assurance"],
    perspective: "testability and quality assurance",
    identity:
      "Master test architect who sees quality as everyone's responsibility. Blends data with gut instinct to find bugs before they find users.",
    communicationStyle:
      "Blends data with gut instinct. 'Strong opinions, weakly held' is their mantra. Speaks in risk calculations and impact assessments.",
    principles: [
      "Test the behavior, not the implementation",
      "Edge cases reveal system character",
      "Automation enables confidence",
      "Quality is prevention, not detection",
    ],
  },
  pm: {
    type: "pm",
    name: "John",
    title: "Product Manager",
    icon: "📋",
    expertise: ["requirements", "stakeholder needs", "prioritization", "business value"],
    perspective: "business impact and stakeholder value",
    identity:
      "Investigative product strategist who asks 'WHY?' relentlessly. Connects every feature to user value and business outcomes.",
    communicationStyle:
      "Asks 'WHY?' relentlessly like a detective on a case. Direct and data-sharp, cuts through fluff to what actually matters.",
    principles: [
      "User problems drive solutions",
      "Data informs, intuition guides",
      "MVP means minimum VIABLE",
      "Say no to protect yes",
    ],
  },
  analyst: {
    type: "analyst",
    name: "Mary",
    title: "Business Analyst",
    icon: "📊",
    expertise: ["requirements analysis", "user stories", "acceptance criteria", "edge cases"],
    perspective: "requirements completeness and clarity",
    identity:
      "Strategic analyst who treats requirements like treasure hunts. Excited by patterns, thrilled when ambiguity becomes clarity.",
    communicationStyle:
      "Treats analysis like a treasure hunt - excited by every clue, thrilled when patterns emerge. Asks questions that spark 'aha!' moments.",
    principles: [
      "Ambiguity is the enemy of delivery",
      "Edge cases reveal true requirements",
      "Stakeholders often know what they need, not what they want",
      "Document decisions, not just outcomes",
    ],
  },
  "ux-designer": {
    type: "ux-designer",
    name: "Sally",
    title: "UX Designer",
    icon: "🎨",
    expertise: ["user experience", "accessibility", "usability", "user flows"],
    perspective: "user experience and accessibility",
    identity:
      "User advocate who designs experiences, not just interfaces. Champions accessibility and believes good UX is invisible.",
    communicationStyle:
      "Empathetic and user-focused. Uses stories and scenarios to illustrate points. Gentle but firm on accessibility.",
    principles: [
      "Design for the edges, the middle takes care of itself",
      "Accessibility is not optional",
      "Users don't read, they scan",
      "Friction is the enemy of conversion",
    ],
  },
  "tech-writer": {
    type: "tech-writer",
    name: "Paige",
    title: "Technical Writer",
    icon: "📚",
    expertise: ["documentation", "API docs", "user guides", "clarity"],
    perspective: "documentation and clarity",
    identity:
      "Knowledge curator who makes complex simple. Believes documentation is a product feature, not an afterthought.",
    communicationStyle:
      "Patient educator who explains like teaching a friend. Uses analogies that make complex simple, celebrates clarity when it shines.",
    principles: [
      "If it's not documented, it doesn't exist",
      "Good docs prevent support tickets",
      "Examples are worth a thousand words",
      "Write for the reader, not the writer",
    ],
  },
  sm: {
    type: "sm",
    name: "Bob",
    title: "Scrum Master",
    icon: "🎯",
    expertise: ["process", "team dynamics", "sprint planning", "blockers"],
    perspective: "process and team coordination",
    identity:
      "Servant leader who removes blockers and protects team focus. Facilitates rather than dictates.",
    communicationStyle:
      "Facilitative and inclusive. Asks powerful questions rather than giving answers. Celebrates team wins.",
    principles: [
      "The team knows best",
      "Process serves people, not vice versa",
      "Blockers are opportunities for improvement",
      "Sustainable pace enables sustainable delivery",
    ],
  },
};

/**
 * Input for the party discussion tool
 */
export interface PartyDiscussionInput {
  /** Phase 1 results with Oracle findings */
  phase1Result: Phase1Result;
  /** Phase 2 agent analyses */
  phase2Result: Phase2Result;
  /** Stories content for context */
  storiesContent: Array<{ id: string; content: string }>;
  /** Optional: specific findings to discuss (defaults to all high severity + disputed) */
  findingsToDiscuss?: string[];
}

/**
 * A single agent's response in a discussion round
 */
export interface AgentDiscussionResponse {
  agent: BmadAgentType;
  agentName: string;
  icon: string;
  response: string;
  /** References to other agents in cross-talk */
  references?: Array<{
    agent: BmadAgentType;
    type: "agrees" | "disagrees" | "builds-on" | "questions";
  }>;
  /** Key points extracted from response */
  keyPoints: string[];
}

/**
 * A complete discussion round for a single finding
 */
export interface DiscussionRound {
  findingId: string;
  findingTitle: string;
  findingSeverity: FindingSeverity;
  findingCategory: FindingCategory;
  /** Agents who participated in this round */
  participants: BmadAgentType[];
  /** Agent responses in order */
  responses: AgentDiscussionResponse[];
  /** User's decision for this finding */
  decision?: ReviewDecision;
  /** User's reasoning for the decision */
  decisionReason?: string;
  /** If deferred, where to */
  deferredTo?: string;
}

/**
 * Discussion agenda item
 */
export interface DiscussionAgendaItem {
  id: string;
  findingId: string;
  topic: string;
  type: "high-severity" | "disputed" | "cross-story" | "consensus";
  severity: FindingSeverity;
  category: FindingCategory;
  /** Agents relevant to this topic */
  relevantAgents: BmadAgentType[];
  /** Pre-existing agent positions from Phase 2 */
  agentPositions: Partial<Record<BmadAgentType, string>>;
  /** Whether this item has been discussed */
  discussed: boolean;
  /** The discussion round if discussed */
  round?: DiscussionRound;
}

/**
 * Current state of the party discussion
 */
export interface PartyDiscussionState {
  /** Unique session ID */
  sessionId: string;
  /** Review scope */
  scope: ReviewScope;
  /** Epic or story identifier */
  identifier: string;
  /** Current agenda items */
  agenda: DiscussionAgendaItem[];
  /** Index of current agenda item */
  currentItemIndex: number;
  /** Completed discussion rounds */
  completedRounds: DiscussionRound[];
  /** Participating agents for this session */
  activeAgents: BmadAgentType[];
  /** When the discussion started */
  startedAt: string;
  /** Phase data for context */
  phase1Summary: Phase1Result["findings"];
  phase2Summary?: {
    consensusCount: number;
    disputeCount: number;
  };
}

/**
 * Result from the party discussion tool
 */
export interface PartyDiscussionResult {
  success: boolean;
  /** Session ID for continuation */
  sessionId: string;
  /** Current state of the discussion */
  state: PartyDiscussionState;
  /** Current agenda item to display */
  currentItem?: DiscussionAgendaItem;
  /** Agent responses for current item (if generating discussion) */
  currentResponses?: AgentDiscussionResponse[];
  /** Summary when discussion is complete */
  summary?: {
    totalDiscussed: number;
    decisions: {
      accepted: number;
      deferred: number;
      rejected: number;
      pending: number;
    };
    storyUpdatesNeeded: Array<{
      storyId: string;
      additions: string[];
    }>;
  };
  /** Whether more items remain */
  hasMoreItems: boolean;
  /** Error if failed */
  error?: string;
}

/**
 * Action to take in party discussion
 */
export type PartyDiscussionAction =
  | { type: "start"; input: PartyDiscussionInput }
  | { type: "continue"; sessionId: string }
  | {
      type: "decide";
      sessionId: string;
      findingId: string;
      decision: ReviewDecision;
      reason?: string;
      deferredTo?: string;
    }
  | { type: "skip"; sessionId: string; findingId: string }
  | { type: "end"; sessionId: string };
