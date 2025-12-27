/**
 * Story Tracker
 *
 * Tracks the current story state and persists it across sessions.
 * State is stored in ~/.config/opencode/athena/athena-state.json
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CONFIG_PATHS } from "../../shared/constants.js";
import type {
  OpenCodeTodo,
  TrackedStory,
  TrackerState,
  TrackerStatus,
} from "../../shared/types.js";
import { createPluginLogger } from "../utils/plugin-logger.js";

const log = createPluginLogger("story-tracker");

/**
 * Story tracker that persists state across sessions.
 *
 * Features:
 * - Tracks current story being implemented
 * - Maintains history of story status changes
 * - Persists state to disk for session recovery
 * - Scoped to project directory
 */
export class StoryTracker {
  private state: TrackerState;
  private stateFilePath: string;
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.stateFilePath = CONFIG_PATHS.stateFile;
    this.state = {
      currentStory: null,
      sessionId: crypto.randomUUID(),
      projectDir,
      history: [],
    };
  }

  /**
   * Initialize the tracker by loading existing state
   */
  async initialize(): Promise<void> {
    if (existsSync(this.stateFilePath)) {
      try {
        const content = await readFile(this.stateFilePath, "utf-8");
        const savedState = JSON.parse(content) as TrackerState;

        // Only restore if same project directory
        if (savedState.projectDir === this.projectDir) {
          this.state = {
            ...savedState,
            sessionId: crypto.randomUUID(), // Always generate new session ID
          };
        }
      } catch {
        // Ignore errors, start with fresh state
      }
    }
  }

  /**
   * Set the current story being worked on
   */
  async setCurrentStory(storyId: string, data: Omit<TrackedStory, "id">): Promise<void> {
    this.state.currentStory = { id: storyId, ...data };
    this.addHistoryEntry(storyId, data.status);
    await this.saveState();
  }

  /**
   * Update the status of a story
   */
  async updateStoryStatus(storyId: string, status: TrackerStatus): Promise<void> {
    if (this.state.currentStory?.id === storyId) {
      this.state.currentStory.status = status;
      if (status === "completed") {
        this.state.currentStory.completedAt = new Date().toISOString();
      }
    }
    this.addHistoryEntry(storyId, status);
    await this.saveState();
  }

  /**
   * Get the current story being tracked
   */
  getCurrentStory(): TrackedStory | null {
    return this.state.currentStory;
  }

  /**
   * Get a formatted context string for the current story
   * Used for compaction hooks to preserve context
   */
  async getCurrentStoryContext(): Promise<string | null> {
    if (!this.state.currentStory) {
      return null;
    }

    const story = this.state.currentStory;
    const recentHistory = this.state.history
      .slice(-5)
      .map((h) => `- ${h.storyId}: ${h.status} at ${h.timestamp}`)
      .join("\n");

    return `
Current Story: ${story.id}
Status: ${story.status}
Started: ${story.startedAt}
${story.completedAt ? `Completed: ${story.completedAt}` : ""}

Recent Activity:
${recentHistory}
`.trim();
  }

  /**
   * Clear the current story (e.g., when completed or cancelled)
   */
  async clearCurrentStory(): Promise<void> {
    this.state.currentStory = null;
    await this.saveState();
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.state.sessionId;
  }

  /**
   * Get the history of status changes
   */
  getHistory(): TrackerState["history"] {
    return this.state.history;
  }

  getCurrentTodos(): OpenCodeTodo[] | null {
    return this.state.currentTodos || null;
  }

  setCurrentTodos(todos: OpenCodeTodo[]): void {
    this.state.currentTodos = todos;
    this.saveState();
  }

  clearTodos(): void {
    this.state.currentTodos = undefined;
    this.saveState();
  }

  /**
   * Add an entry to the history
   */
  private addHistoryEntry(storyId: string, status: string): void {
    this.state.history.push({
      storyId,
      status,
      timestamp: new Date().toISOString(),
    });

    // Keep history bounded (last 100 entries)
    if (this.state.history.length > 100) {
      this.state.history = this.state.history.slice(-100);
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    try {
      const dir = dirname(this.stateFilePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      await writeFile(this.stateFilePath, JSON.stringify(this.state, null, 2), "utf-8");
    } catch (error) {
      log.warn("Failed to save tracker state", { error });
    }
  }
}
