import { z } from "zod";

/**
 * Zod validation schemas for OpenCode Athena
 */

// ============================================================================
// Configuration Schemas
// ============================================================================

/**
 * Schema for subscription configuration
 */
export const SubscriptionSchema = z.object({
  claude: z.object({
    enabled: z.boolean(),
    tier: z.enum(["max5x", "max20x", "pro", "none"]),
  }),
  openai: z.object({
    enabled: z.boolean(),
  }),
  google: z.object({
    enabled: z.boolean(),
    authMethod: z.enum(["antigravity", "personal", "api", "none"]),
  }),
  githubCopilot: z.object({
    enabled: z.boolean(),
    plan: z.enum(["free", "pro", "pro-plus", "business", "enterprise", "none"]),
    enabledModels: z.array(z.string()).optional(),
  }),
});

/**
 * Schema for BMAD configuration
 */
export const BmadConfigSchema = z.object({
  defaultTrack: z.enum(["quick-flow", "bmad-method", "enterprise"]),
  autoStatusUpdate: z.boolean(),
  parallelStoryLimit: z.number().int().min(0).max(10),
  paths: z
    .object({
      stories: z
        .string()
        .nullable()
        .optional()
        .describe("Custom path to stories directory (null = auto-detect)"),
      sprintStatus: z
        .string()
        .nullable()
        .optional()
        .describe("Custom path to sprint-status.yaml file (null = auto-detect)"),
      prd: z
        .string()
        .nullable()
        .optional()
        .describe("Custom path to PRD.md file (null = auto-detect)"),
      architecture: z
        .string()
        .nullable()
        .optional()
        .describe("Custom path to architecture.md file (null = auto-detect)"),
      epics: z
        .string()
        .nullable()
        .optional()
        .describe("Custom path to epics.md file (null = auto-detect)"),
    })
    .optional(),
});

/**
 * Schema for feature flags
 */
export const FeaturesSchema = z.object({
  bmadBridge: z.boolean(),
  autoStatus: z.boolean(),
  parallelExecution: z.boolean(),
  notifications: z.boolean(),
  contextMonitor: z.boolean(),
  commentChecker: z.boolean(),
  lspTools: z.boolean(),
  autoGitOperations: z.boolean().default(false),
});

/**
 * Schema for MCP configuration
 */
export const McpsSchema = z.object({
  context7: z.boolean(),
  exa: z.boolean(),
  grepApp: z.boolean(),
});

/**
 * Schema for thinking level
 */
export const ThinkingLevelSchema = z.enum(["off", "low", "medium", "high"]);

/**
 * Schema for agent settings (temperature and thinking level)
 */
export const AgentSettingsSchema = z.object({
  temperature: z.number().min(0).max(1).optional(),
  thinkingLevel: ThinkingLevelSchema.optional(),
});

/**
 * Schema for custom model definition
 */
export const CustomModelDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(["anthropic", "openai", "google", "github-copilot"]),
  description: z.string().optional(),
  capabilities: z
    .object({
      thinking: z.boolean().optional(),
      contextWindow: z.number().optional(),
      supportsTemperature: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Schema for agent model assignments
 */
export const ModelsSchema = z.object({
  sisyphus: z.string().describe("Model for main orchestrator agent"),
  oracle: z.string().describe("Model for debugging/reasoning agent"),
  librarian: z.string().describe("Model for research/documentation agent"),
  frontend: z.string().optional().describe("Model for UI/UX agent"),
  documentWriter: z.string().optional().describe("Model for documentation generation agent"),
  multimodalLooker: z.string().optional().describe("Model for image analysis agent"),
  settings: z
    .object({
      sisyphus: AgentSettingsSchema.optional(),
      oracle: AgentSettingsSchema.optional(),
      librarian: AgentSettingsSchema.optional(),
      frontend: AgentSettingsSchema.optional(),
      documentWriter: AgentSettingsSchema.optional(),
      multimodalLooker: AgentSettingsSchema.optional(),
      overrides: z.record(z.string(), AgentSettingsSchema).optional(),
    })
    .optional(),
  custom: z.array(CustomModelDefinitionSchema).optional(),
});

/**
 * Complete Athena configuration schema
 */
export const AthenaConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  subscriptions: SubscriptionSchema,
  models: ModelsSchema,
  bmad: BmadConfigSchema,
  features: FeaturesSchema,
  mcps: McpsSchema,
});

// ============================================================================
// Tool Argument Schemas
// ============================================================================

/**
 * Schema for athena_get_story arguments
 */
export const GetStoryArgsSchema = z.object({
  storyId: z
    .string()
    .optional()
    .describe(
      "Specific story ID (e.g., '2.3'). If omitted, loads the next pending story from sprint-status.yaml."
    ),
});

/**
 * Schema for athena_update_status arguments
 */
export const UpdateStatusArgsSchema = z.object({
  storyId: z.string().describe("The story ID (e.g., '2.3')"),
  status: z
    .enum(["in_progress", "completed", "blocked", "needs_review"])
    .describe("The new status for the story"),
  notes: z
    .string()
    .optional()
    .describe("Notes about the status change (required for 'blocked' status)"),
  completionSummary: z
    .string()
    .optional()
    .describe("Summary of what was implemented (required for 'completed' status)"),
});

/**
 * Schema for athena_get_context arguments
 */
export const GetContextArgsSchema = z.object({
  includeArchitecture: z.boolean().optional().default(true),
  includePrd: z.boolean().optional().default(false),
  includeSprintStatus: z.boolean().optional().default(true),
});

/**
 * Schema for athena_parallel arguments
 */
export const ParallelArgsSchema = z.object({
  storyIds: z.array(z.string()).describe("Array of story IDs to implement in parallel"),
  maxConcurrent: z.number().int().min(1).max(5).optional().default(3),
});

/**
 * Schema for athena_config arguments
 */
export const ConfigArgsSchema = z.object({
  action: z.enum(["get", "set", "reset"]).describe("Configuration action to perform"),
  key: z
    .string()
    .optional()
    .describe("Configuration key (dot notation, e.g., 'bmad.autoStatusUpdate')"),
  value: z.unknown().optional().describe("Value to set (for 'set' action)"),
});

// ============================================================================
// Sprint Status Schema
// ============================================================================

/**
 * Story status enum for sprint tracking
 */
export const StoryStatusEnum = z.enum([
  "pending",
  "in_progress",
  "completed",
  "blocked",
  "needs_review",
]);

/**
 * Tracker status enum (includes transitional states)
 */
export const TrackerStatusEnum = z.enum([
  "pending",
  "in_progress",
  "completed",
  "blocked",
  "needs_review",
  "loading",
]);

/**
 * Schema for sprint-status.yaml content
 */
export const SprintStatusSchema = z.object({
  sprint_number: z.number().int().optional(),
  current_epic: z.string().optional(),
  current_story: z.string().nullable().optional(),
  completed_stories: z.array(z.string()).default([]),
  pending_stories: z.array(z.string()).default([]),
  in_progress_stories: z.array(z.string()).default([]),
  blocked_stories: z.array(z.string()).default([]),
  stories_needing_review: z.array(z.string()).optional(),
  story_updates: z
    .record(
      z.object({
        status: StoryStatusEnum,
        updated_at: z.string(),
        notes: z.string().optional(),
        completion_summary: z.string().optional(),
      })
    )
    .optional(),
  last_modified: z.string().optional(),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type SubscriptionConfig = z.infer<typeof SubscriptionSchema>;
export type BmadConfig = z.infer<typeof BmadConfigSchema>;
export type FeaturesConfig = z.infer<typeof FeaturesSchema>;
export type McpsConfig = z.infer<typeof McpsSchema>;
export type ModelsConfig = z.infer<typeof ModelsSchema>;
export type AthenaConfigValidated = z.infer<typeof AthenaConfigSchema>;
export type SprintStatusValidated = z.infer<typeof SprintStatusSchema>;
