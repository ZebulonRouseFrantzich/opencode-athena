---
description: Implement the current BMAD story using Sisyphus and specialized subagents
---

# Athena Dev - Story Implementation

You are implementing a BMAD story using OpenCode Athena's full capabilities.

## Step 1: Load Story Context

First, call the **athena_get_story** tool to load the current story context:

```
athena_get_story()
```

If you need a specific story, pass the story ID:

```
athena_get_story({ storyId: "2.3" })
```

## Step 2: Understand the Story

Review the returned context:
- **Story content**: Requirements and acceptance criteria
- **Architecture**: Relevant technical patterns and decisions
- **Sprint progress**: Where this story fits in the overall sprint

## Step 3: Implement with Full Capabilities

You are Sisyphus, the orchestrator. Use your full toolkit:

### Subagents
- **@oracle** - For complex debugging, architectural decisions, strategic code choices
- **@librarian** - For finding implementation examples, researching patterns
- **@explore** - For fast codebase searches and pattern matching
- **@frontend-ui-ux-engineer** - For UI components (if applicable)

### Tools
- **LSP tools** (lsp_rename, lsp_find_references, lsp_code_actions) for refactoring
- **AST-grep** (ast_grep_search, ast_grep_replace) for structural changes
- **Background agents** for parallelizable work

### Quality Standards
1. Meet ALL acceptance criteria
2. Follow architecture patterns exactly
3. Minimize comments - code should be self-documenting
4. Run tests before marking complete
5. No regressions in existing functionality

## Step 4: Complete the Story

When implementation is done, call **athena_update_status**:

```
athena_update_status({
  storyId: "<the story ID>",
  status: "completed",
  completionSummary: "Implemented <feature>. Added <components>. Tests passing."
})
```

## If You Get Blocked

If you encounter a blocker:

```
athena_update_status({
  storyId: "<the story ID>",
  status: "blocked",
  notes: "Blocked because <reason>. Need <what you need> to proceed."
})
```

Then explain the blocker so the user can help resolve it.
