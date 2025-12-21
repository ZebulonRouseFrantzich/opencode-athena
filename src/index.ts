/**
 * OpenCode Athena
 *
 * Strategic wisdom meets practical execution.
 * A unified oh-my-opencode + BMAD METHOD toolkit for OpenCode.
 *
 * @packageDocumentation
 */

// Re-export the plugin as the default export
export { OpenCodeAthena as default } from "./plugin/index.js";

// Export plugin explicitly
export { OpenCodeAthena } from "./plugin/index.js";

// Export shared types for consumers
export type {
  AthenaConfig,
  InstallAnswers,
  InstallOptions,
  Prerequisites,
  SprintStatus,
  StoryStatus,
  TrackerStatus,
  TrackedStory,
  TrackerState,
  GetStoryResult,
  UpdateStatusResult,
} from "./shared/types.js";

// Export schemas for validation
export {
  AthenaConfigSchema,
  SprintStatusSchema,
  StoryStatusEnum,
  TrackerStatusEnum,
  GetStoryArgsSchema,
  UpdateStatusArgsSchema,
} from "./shared/schemas.js";

// Export constants
export {
  VERSION,
  PACKAGE_NAME,
  DISPLAY_NAME,
  CONFIG_PATHS,
  PROJECT_PATHS,
  DEFAULTS,
} from "./shared/constants.js";
