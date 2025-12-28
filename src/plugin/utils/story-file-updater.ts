import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { BmadStoryStatus } from "../../shared/types.js";
import { createPluginLogger } from "./plugin-logger.js";

const log = createPluginLogger("story-file-updater");

const STATUS_LINE_PATTERN = /^Status:\s*(.+)$/im;
const STORY_TITLE_PATTERN = /^#\s*Story\s*[\d.]+:\s*(.+)$/im;

export interface StoryFileUpdateResult {
  success: boolean;
  previousStatus?: string;
  newStatus?: BmadStoryStatus;
  error?: string;
}

export interface StoryFileInfo {
  status: string | null;
  title: string | null;
}

export async function getStoryFileInfo(storyPath: string): Promise<StoryFileInfo | null> {
  if (!existsSync(storyPath)) {
    return null;
  }

  try {
    const content = await readFile(storyPath, "utf-8");

    const statusMatch = content.match(STATUS_LINE_PATTERN);
    const titleMatch = content.match(STORY_TITLE_PATTERN);

    return {
      status: statusMatch ? statusMatch[1].trim() : null,
      title: titleMatch ? titleMatch[1].trim() : null,
    };
  } catch (error) {
    log.warn("Failed to read story file", { storyPath, error });
    return null;
  }
}

export async function updateStoryFileStatus(
  storyPath: string,
  newStatus: BmadStoryStatus
): Promise<StoryFileUpdateResult> {
  if (!existsSync(storyPath)) {
    return {
      success: false,
      error: `Story file not found: ${storyPath}`,
    };
  }

  try {
    const content = await readFile(storyPath, "utf-8");
    const statusMatch = content.match(STATUS_LINE_PATTERN);

    if (!statusMatch) {
      const lines = content.split("\n");
      let insertIndex = 0;

      if (lines[0]?.startsWith("#")) {
        insertIndex = 1;
        while (insertIndex < lines.length && lines[insertIndex]?.trim() === "") {
          insertIndex++;
        }
      }

      lines.splice(insertIndex, 0, "", `Status: ${newStatus}`, "");
      const updatedContent = lines.join("\n");

      await writeFile(storyPath, updatedContent, "utf-8");

      log.info("Added Status line to story file", { storyPath, newStatus });

      return {
        success: true,
        previousStatus: undefined,
        newStatus,
      };
    }

    const previousStatus = statusMatch[1].trim();

    if (previousStatus === newStatus) {
      return {
        success: true,
        previousStatus,
        newStatus,
      };
    }

    const updatedContent = content.replace(STATUS_LINE_PATTERN, `Status: ${newStatus}`);

    await writeFile(storyPath, updatedContent, "utf-8");

    log.info("Updated story file status", {
      storyPath,
      previousStatus,
      newStatus,
    });

    return {
      success: true,
      previousStatus,
      newStatus,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Failed to update story file status", { storyPath, error });

    return {
      success: false,
      error: `Failed to update story file: ${errorMessage}`,
    };
  }
}

export async function getStoryTitle(storyPath: string): Promise<string | null> {
  const info = await getStoryFileInfo(storyPath);
  return info?.title ?? null;
}

export function extractTitleFromContent(content: string): string | null {
  const match = content.match(STORY_TITLE_PATTERN);
  return match ? match[1].trim() : null;
}
