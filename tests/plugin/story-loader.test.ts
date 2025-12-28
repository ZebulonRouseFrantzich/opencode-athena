import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findStoriesForEpic,
  findStoryFile,
  getStoryFilenamePatterns,
  isStoryFile,
  loadStoryContent,
  loadStoryFromPath,
  looksLikeFilePath,
  normalizeStoryId,
  parseStoryIdFromFilename,
  resolveStoryIdentifier,
  stripAtPrefix,
} from "../../src/plugin/utils/story-loader.js";

describe("story-loader", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `story-loader-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("parseStoryIdFromFilename", () => {
    it("parses story-{epic}-{number}.md format", () => {
      const result = parseStoryIdFromFilename("story-4-1.md");
      expect(result).toEqual({
        id: "4.1",
        epic: "4",
        number: "1",
        hasStoryPrefix: true,
      });
    });

    it("parses story-{epic}-{number}-{title}.md format", () => {
      const result = parseStoryIdFromFilename("story-4-1-fastify-setup.md");
      expect(result).toEqual({
        id: "4.1",
        epic: "4",
        number: "1",
        hasStoryPrefix: true,
      });
    });

    it("parses {epic}-{number}.md format", () => {
      const result = parseStoryIdFromFilename("4-1.md");
      expect(result).toEqual({
        id: "4.1",
        epic: "4",
        number: "1",
        hasStoryPrefix: false,
      });
    });

    it("parses {epic}-{number}-{title}.md format", () => {
      const result = parseStoryIdFromFilename("4-1-fastify-setup.md");
      expect(result).toEqual({
        id: "4.1",
        epic: "4",
        number: "1",
        hasStoryPrefix: false,
      });
    });

    it("handles case-insensitive matching", () => {
      expect(parseStoryIdFromFilename("STORY-4-1.md")).toEqual({
        id: "4.1",
        epic: "4",
        number: "1",
        hasStoryPrefix: true,
      });
      expect(parseStoryIdFromFilename("Story-4-1.MD")).toEqual({
        id: "4.1",
        epic: "4",
        number: "1",
        hasStoryPrefix: true,
      });
    });

    it("returns null for non-story files", () => {
      expect(parseStoryIdFromFilename("README.md")).toBeNull();
      expect(parseStoryIdFromFilename("notes.md")).toBeNull();
      expect(parseStoryIdFromFilename("epic-4.md")).toBeNull();
      expect(parseStoryIdFromFilename("story.md")).toBeNull();
    });
  });

  describe("normalizeStoryId", () => {
    it("normalizes story-4-1 format", () => {
      expect(normalizeStoryId("story-4-1")).toBe("4.1");
    });

    it("normalizes 4-1 format", () => {
      expect(normalizeStoryId("4-1")).toBe("4.1");
    });

    it("preserves 4.1 format", () => {
      expect(normalizeStoryId("4.1")).toBe("4.1");
    });

    it("normalizes file paths", () => {
      expect(normalizeStoryId("docs/stories/story-4-1.md")).toBe("4.1");
      expect(normalizeStoryId("stories/4-1-setup.md")).toBe("4.1");
    });

    it("handles case-insensitive prefixes", () => {
      expect(normalizeStoryId("STORY-4-1")).toBe("4.1");
      expect(normalizeStoryId("Story-4-1")).toBe("4.1");
    });
  });

  describe("isStoryFile", () => {
    it("returns true for valid story patterns", () => {
      expect(isStoryFile("story-4-1.md")).toBe(true);
      expect(isStoryFile("story-4-1-title.md")).toBe(true);
      expect(isStoryFile("4-1.md")).toBe(true);
      expect(isStoryFile("4-1-title.md")).toBe(true);
      expect(isStoryFile("STORY-4-1.md")).toBe(true);
    });

    it("returns false for non-story files", () => {
      expect(isStoryFile("README.md")).toBe(false);
      expect(isStoryFile("epic-4.md")).toBe(false);
      expect(isStoryFile("notes.txt")).toBe(false);
    });
  });

  describe("getStoryFilenamePatterns", () => {
    it("returns expected patterns for a story ID", () => {
      const patterns = getStoryFilenamePatterns("4.1");
      expect(patterns).toContain("story-4-1.md");
      expect(patterns).toContain("story-4-1-*.md");
      expect(patterns).toContain("4-1.md");
      expect(patterns).toContain("4-1-*.md");
    });
  });

  describe("findStoryFile", () => {
    it("finds story with story- prefix", async () => {
      writeFileSync(join(testDir, "story-4-1.md"), "# Story 4.1");

      const result = await findStoryFile(testDir, "4.1");
      expect(result).not.toBeNull();
      expect(result?.storyId).toBe("4.1");
      expect(result?.filename).toBe("story-4-1.md");
    });

    it("finds story without prefix", async () => {
      writeFileSync(join(testDir, "4-1.md"), "# Story 4.1");

      const result = await findStoryFile(testDir, "4.1");
      expect(result).not.toBeNull();
      expect(result?.storyId).toBe("4.1");
      expect(result?.filename).toBe("4-1.md");
    });

    it("finds story with descriptive name", async () => {
      writeFileSync(join(testDir, "4-1-fastify-setup.md"), "# Story 4.1");

      const result = await findStoryFile(testDir, "4.1");
      expect(result).not.toBeNull();
      expect(result?.storyId).toBe("4.1");
      expect(result?.filename).toBe("4-1-fastify-setup.md");
    });

    it("prioritizes story- prefix over non-prefixed", async () => {
      writeFileSync(join(testDir, "story-4-1.md"), "# Story 4.1 (prefixed)");
      writeFileSync(join(testDir, "4-1-setup.md"), "# Story 4.1 (non-prefixed)");

      const mockLogger = { warn: vi.fn() };
      const result = await findStoryFile(testDir, "4.1", mockLogger);

      expect(result).not.toBeNull();
      expect(result?.filename).toBe("story-4-1.md");
      expect(result?.hasMultipleMatches).toBe(true);
      expect(result?.alternativeFiles).toContain("4-1-setup.md");
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("returns null for non-existent story", async () => {
      const result = await findStoryFile(testDir, "99.99");
      expect(result).toBeNull();
    });

    it("returns null for non-existent directory", async () => {
      const result = await findStoryFile("/nonexistent/path", "4.1");
      expect(result).toBeNull();
    });

    it("handles case-insensitive matching", async () => {
      writeFileSync(join(testDir, "STORY-4-1.md"), "# Story 4.1");

      const result = await findStoryFile(testDir, "4.1");
      expect(result).not.toBeNull();
      expect(result?.filename).toBe("STORY-4-1.md");
    });

    it("accepts various input formats", async () => {
      writeFileSync(join(testDir, "story-4-1.md"), "# Story 4.1");

      expect((await findStoryFile(testDir, "4.1"))?.storyId).toBe("4.1");
      expect((await findStoryFile(testDir, "4-1"))?.storyId).toBe("4.1");
      expect((await findStoryFile(testDir, "story-4-1"))?.storyId).toBe("4.1");
    });
  });

  describe("findStoriesForEpic", () => {
    it("finds all stories for an epic", async () => {
      writeFileSync(join(testDir, "story-4-1.md"), "# Story 4.1");
      writeFileSync(join(testDir, "story-4-2.md"), "# Story 4.2");
      writeFileSync(join(testDir, "story-4-3.md"), "# Story 4.3");
      writeFileSync(join(testDir, "story-5-1.md"), "# Story 5.1");

      const result = await findStoriesForEpic(testDir, "4");
      expect(result).toHaveLength(3);
      expect(result.map((s) => s.id)).toEqual(["4.1", "4.2", "4.3"]);
    });

    it("finds stories with descriptive names", async () => {
      writeFileSync(join(testDir, "4-1-fastify-setup.md"), "# Story 4.1");
      writeFileSync(join(testDir, "4-2-hmac-auth.md"), "# Story 4.2");

      const result = await findStoriesForEpic(testDir, "4");
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.id)).toEqual(["4.1", "4.2"]);
    });

    it("handles epic- prefix in input", async () => {
      writeFileSync(join(testDir, "story-4-1.md"), "# Story 4.1");

      const result = await findStoriesForEpic(testDir, "epic-4");
      expect(result).toHaveLength(1);
    });

    it("returns empty array for non-existent epic", async () => {
      writeFileSync(join(testDir, "story-4-1.md"), "# Story 4.1");

      const result = await findStoriesForEpic(testDir, "99");
      expect(result).toHaveLength(0);
    });

    it("prioritizes story- prefix for duplicates", async () => {
      writeFileSync(join(testDir, "story-4-1.md"), "# Story 4.1 (prefixed)");
      writeFileSync(join(testDir, "4-1-setup.md"), "# Story 4.1 (non-prefixed)");

      const mockLogger = { warn: vi.fn() };
      const result = await findStoriesForEpic(testDir, "4", mockLogger);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe("story-4-1.md");
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("skips non-story files silently", async () => {
      writeFileSync(join(testDir, "story-4-1.md"), "# Story 4.1");
      writeFileSync(join(testDir, "README.md"), "# README");
      writeFileSync(join(testDir, "notes.md"), "# Notes");

      const result = await findStoriesForEpic(testDir, "4");
      expect(result).toHaveLength(1);
    });

    it("sorts stories by number", async () => {
      writeFileSync(join(testDir, "story-4-10.md"), "# Story 4.10");
      writeFileSync(join(testDir, "story-4-2.md"), "# Story 4.2");
      writeFileSync(join(testDir, "story-4-1.md"), "# Story 4.1");

      const result = await findStoriesForEpic(testDir, "4");
      expect(result.map((s) => s.id)).toEqual(["4.1", "4.2", "4.10"]);
    });
  });

  describe("loadStoryContent", () => {
    it("loads story content successfully", async () => {
      const content = "# Story 4.1\n\nThis is the story content.";
      writeFileSync(join(testDir, "story-4-1.md"), content);

      const result = await loadStoryContent(testDir, "4.1");
      expect(result).not.toBeNull();
      expect(result?.content).toBe(content);
      expect(result?.filename).toBe("story-4-1.md");
    });

    it("returns null for non-existent story", async () => {
      const result = await loadStoryContent(testDir, "99.99");
      expect(result).toBeNull();
    });
  });

  describe("stripAtPrefix", () => {
    it("strips @ prefix from file references", () => {
      expect(stripAtPrefix("@docs/stories/story-4-1.md")).toBe("docs/stories/story-4-1.md");
      expect(stripAtPrefix("@story-4-1.md")).toBe("story-4-1.md");
    });

    it("preserves strings without @ prefix", () => {
      expect(stripAtPrefix("4.1")).toBe("4.1");
      expect(stripAtPrefix("story-4-1")).toBe("story-4-1");
      expect(stripAtPrefix("docs/stories/story-4-1.md")).toBe("docs/stories/story-4-1.md");
    });

    it("only strips leading @ prefix", () => {
      expect(stripAtPrefix("user@example.com")).toBe("user@example.com");
      expect(stripAtPrefix("file@path")).toBe("file@path");
    });
  });

  describe("looksLikeFilePath", () => {
    it("returns true for paths with forward slashes", () => {
      expect(looksLikeFilePath("docs/stories/story-4-1.md")).toBe(true);
      expect(looksLikeFilePath("./story-4-1.md")).toBe(true);
      expect(looksLikeFilePath("../stories/story.md")).toBe(true);
    });

    it("returns true for absolute paths", () => {
      expect(looksLikeFilePath("/home/user/story-4-1.md")).toBe(true);
      expect(looksLikeFilePath("/absolute/path/story.md")).toBe(true);
    });

    it("returns false for story IDs", () => {
      expect(looksLikeFilePath("4.1")).toBe(false);
      expect(looksLikeFilePath("story-4-1")).toBe(false);
      expect(looksLikeFilePath("4-1")).toBe(false);
    });

    it("returns false for bare filenames without ./ prefix", () => {
      expect(looksLikeFilePath("story-4-1.md")).toBe(false);
    });
  });

  describe("loadStoryFromPath", () => {
    it("loads story from direct file path", async () => {
      const content = "# Story 4.1\n\nDirect path content.";
      const filePath = join(testDir, "story-4-1.md");
      writeFileSync(filePath, content);

      const result = await loadStoryFromPath(filePath);
      expect(result).not.toBeNull();
      expect(result?.content).toBe(content);
      expect(result?.storyId).toBe("4.1");
      expect(result?.filename).toBe("story-4-1.md");
    });

    it("extracts story ID from filename with title", async () => {
      const content = "# Story content";
      const filePath = join(testDir, "story-4-2-setup-fastify.md");
      writeFileSync(filePath, content);

      const result = await loadStoryFromPath(filePath);
      expect(result?.storyId).toBe("4.2");
    });

    it("returns null for non-existent path", async () => {
      const result = await loadStoryFromPath("/nonexistent/path/story.md");
      expect(result).toBeNull();
    });
  });

  describe("resolveStoryIdentifier", () => {
    it("resolves direct file path when it exists", async () => {
      const content = "# Story 4.1\n\nDirect path content.";
      const subDir = join(testDir, "custom");
      mkdirSync(subDir, { recursive: true });
      const filePath = join(subDir, "story-4-1.md");
      writeFileSync(filePath, content);

      const result = await resolveStoryIdentifier(testDir, filePath);
      expect(result).not.toBeNull();
      expect(result?.content).toBe(content);
      expect(result?.storyId).toBe("4.1");
    });

    it("resolves relative path from project root", async () => {
      const content = "# Story 4.1\n\nRelative path content.";
      const subDir = join(testDir, "docs", "stories");
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, "story-4-1.md"), content);

      const result = await resolveStoryIdentifier(
        join(testDir, "other"),
        "docs/stories/story-4-1.md",
        testDir
      );
      expect(result).not.toBeNull();
      expect(result?.content).toBe(content);
      expect(result?.storyId).toBe("4.1");
    });

    it("strips @ prefix and resolves path", async () => {
      const content = "# Story 4.1\n\nWith @ prefix.";
      const subDir = join(testDir, "docs", "stories");
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, "story-4-1.md"), content);

      const result = await resolveStoryIdentifier(
        join(testDir, "other"),
        "@docs/stories/story-4-1.md",
        testDir
      );
      expect(result).not.toBeNull();
      expect(result?.content).toBe(content);
    });

    it("falls back to storiesDir search for story IDs", async () => {
      const content = "# Story 4.1\n\nFrom storiesDir.";
      writeFileSync(join(testDir, "story-4-1.md"), content);

      const result = await resolveStoryIdentifier(testDir, "4.1");
      expect(result).not.toBeNull();
      expect(result?.content).toBe(content);
      expect(result?.storyId).toBe("4.1");
    });

    it("falls back to storiesDir when file path does not exist", async () => {
      const content = "# Story 4.1\n\nFallback content.";
      writeFileSync(join(testDir, "story-4-1.md"), content);

      const result = await resolveStoryIdentifier(
        testDir,
        "nonexistent/story-4-1.md",
        testDir
      );
      expect(result).not.toBeNull();
      expect(result?.storyId).toBe("4.1");
    });

    it("returns null when story not found anywhere", async () => {
      const result = await resolveStoryIdentifier(testDir, "99.99");
      expect(result).toBeNull();
    });
  });
});
