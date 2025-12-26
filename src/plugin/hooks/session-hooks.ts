/**
 * Session event hooks
 *
 * Handles session lifecycle events like idle, created, and error.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import type { AthenaConfig } from "../../shared/types.js";
import type { StoryTracker } from "../tracker/story-tracker.js";
import { sendNotification } from "../utils/notifications.js";
import { createPluginLogger } from "../utils/plugin-logger.js";

const log = createPluginLogger("session-hooks");

/**
 * Generic event type for session events
 */
interface SessionEvent {
  type?: string;
  error?: unknown;
}

/**
 * Create session event handler
 *
 * Handles:
 * - session.idle: Reminds about in-progress story when session goes idle
 * - session.created: Logs resume of tracked story
 * - session.error: Logs errors during story implementation
 */
export function createSessionHooks(ctx: PluginInput, tracker: StoryTracker, config: AthenaConfig) {
  return async ({ event }: { event: SessionEvent }) => {
    // Event type is in event.type for most events
    const eventType = (event as { type?: string }).type;

    switch (eventType) {
      case "session.idle":
        await handleSessionIdle(ctx, tracker, config);
        break;

      case "session.created":
        handleSessionCreated(tracker);
        break;

      case "session.error":
        handleSessionError(event, tracker);
        break;
    }
  };
}

/**
 * Handle session going idle
 *
 * If a story is in progress, send a reminder notification
 */
async function handleSessionIdle(
  ctx: PluginInput,
  tracker: StoryTracker,
  config: AthenaConfig
): Promise<void> {
  const currentStory = tracker.getCurrentStory();

  if (currentStory && currentStory.status === "in_progress") {
    // Story is in progress but session went idle
    if (config.features?.notifications) {
      await sendNotification(
        `Story ${currentStory.id} in progress. Remember to update status when complete!`,
        "OpenCode Athena",
        ctx.$
      );
    }
  }
}

/**
 * Handle session creation
 *
 * Log if resuming with an active story
 */
function handleSessionCreated(tracker: StoryTracker): void {
  const currentStory = tracker.getCurrentStory();

  if (currentStory) {
    log.info("Session created - resuming with story", {
      storyId: currentStory.id,
      status: currentStory.status,
    });
  }
}

/**
 * Handle session errors
 *
 * Log errors that occur during story implementation
 */
function handleSessionError(event: SessionEvent, tracker: StoryTracker): void {
  const currentStory = tracker.getCurrentStory();

  if (currentStory && event.error) {
    log.error("Session error during story implementation", {
      storyId: currentStory.id,
      error: event.error,
    });
  }
}
