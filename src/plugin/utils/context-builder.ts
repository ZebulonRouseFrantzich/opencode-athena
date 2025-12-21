/**
 * Context builder for BMAD story implementation
 *
 * Extracts relevant sections from architecture and PRD documents
 * based on story content keywords.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

/**
 * Extract relevant architecture sections based on story content
 *
 * Always includes:
 * - Tech Stack section
 * - Patterns/Conventions section
 *
 * Conditionally includes based on keywords:
 * - Data Model section (if story mentions data/database/model/schema)
 * - API section (if story mentions api/endpoint/route)
 *
 * @param archPath - Path to architecture.md
 * @param storyContent - Content of the story file
 * @returns Extracted architecture sections
 */
export async function extractRelevantArchitecture(
  archPath: string,
  storyContent: string
): Promise<string> {
  if (!existsSync(archPath)) {
    return "";
  }

  try {
    const archContent = await readFile(archPath, "utf-8");
    const sections: string[] = [];

    // Always include tech stack section
    const techStackMatch = archContent.match(
      /## Tech(?:nology)? Stack[\s\S]*?(?=\n## |$)/i
    );
    if (techStackMatch) {
      sections.push(techStackMatch[0].trim());
    }

    // Always include patterns/conventions section
    const patternsMatch = archContent.match(
      /## (?:Patterns|Conventions|Standards|Coding Standards)[\s\S]*?(?=\n## |$)/i
    );
    if (patternsMatch) {
      sections.push(patternsMatch[0].trim());
    }

    // Include data model section if story mentions data/database
    if (/data|database|model|schema|entity/i.test(storyContent)) {
      const dataMatch = archContent.match(
        /## (?:Data Model|Database|Schema|Data Layer)[\s\S]*?(?=\n## |$)/i
      );
      if (dataMatch) {
        sections.push(dataMatch[0].trim());
      }
    }

    // Include API section if story mentions API/endpoint
    if (/api|endpoint|route|rest|graphql/i.test(storyContent)) {
      const apiMatch = archContent.match(
        /## (?:API|Endpoints|Routes|REST|GraphQL)[\s\S]*?(?=\n## |$)/i
      );
      if (apiMatch) {
        sections.push(apiMatch[0].trim());
      }
    }

    // Include UI/component section if story mentions UI
    if (/ui|component|view|page|screen|frontend/i.test(storyContent)) {
      const uiMatch = archContent.match(
        /## (?:UI|Components|Views|Frontend|User Interface)[\s\S]*?(?=\n## |$)/i
      );
      if (uiMatch) {
        sections.push(uiMatch[0].trim());
      }
    }

    return sections.length > 0
      ? sections.join("\n\n---\n\n")
      : "See full architecture document for details.";
  } catch (error) {
    console.warn(`[Athena] Failed to read architecture file:`, error);
    return "";
  }
}

/**
 * Extract relevant PRD sections based on story content
 *
 * Looks for functional requirement (FR) references in the story
 * and extracts those sections from the PRD.
 *
 * @param prdPath - Path to PRD.md
 * @param storyContent - Content of the story file
 * @returns Extracted PRD sections
 */
export async function extractRelevantPRD(
  prdPath: string,
  storyContent: string
): Promise<string> {
  if (!existsSync(prdPath)) {
    return "";
  }

  try {
    const prdContent = await readFile(prdPath, "utf-8");

    // Extract FR references from story (e.g., FR-1, FR1, FR-001)
    const frMatches = storyContent.match(/FR-?\d+/gi);

    if (!frMatches || frMatches.length === 0) {
      return "";
    }

    // Deduplicate FR references
    const uniqueFRs = [...new Set(frMatches.map((fr) => fr.toUpperCase()))];
    const sections: string[] = [];

    for (const fr of uniqueFRs) {
      // Try to find the FR section in the PRD
      // Match patterns like "### FR-1" or "#### FR1" or "### FR-001: Title"
      const normalizedFR = fr.replace("-", "-?");
      const regex = new RegExp(
        `###+ ${normalizedFR}[:\\s][\\s\\S]*?(?=\\n###+ |$)`,
        "i"
      );
      const match = prdContent.match(regex);

      if (match) {
        sections.push(match[0].trim());
      }
    }

    return sections.join("\n\n");
  } catch (error) {
    console.warn(`[Athena] Failed to read PRD file:`, error);
    return "";
  }
}

/**
 * Generate implementation instructions for a story
 *
 * @param storyId - The story ID
 * @returns Markdown instructions for implementing the story
 */
export function generateImplementationInstructions(storyId: string): string {
  return `
## Implementation Instructions for Story ${storyId}

You are implementing this story using OpenCode Athena's full capabilities.

### Available Subagents
- **@oracle** - Use for complex debugging, architectural decisions, or strategic code choices
- **@librarian** - Use for finding implementation examples, researching patterns, exploring documentation
- **@explore** - Use for fast codebase searches and pattern matching
- **@frontend-ui-ux-engineer** - Use for UI component implementation (if applicable)

### Available Tools
- **LSP Tools** - Use lsp_rename, lsp_find_references, lsp_code_actions for refactoring
- **AST-Grep** - Use ast_grep_search and ast_grep_replace for structural code changes

### Quality Standards
1. Meet ALL acceptance criteria listed in the story
2. Follow architecture patterns exactly as specified
3. Keep comments minimal - code should be self-documenting
4. Run tests before marking complete
5. Ensure no regressions in existing functionality

### Completion
When implementation is complete:
1. Call **athena_update_status** with status "completed" and a completion summary
2. The sprint-status.yaml will be automatically updated
3. Report what was implemented and any decisions made

### If You Get Stuck
- Call @oracle for debugging help
- Call @librarian to find similar implementations
- Check the architecture document for patterns
`.trim();
}
