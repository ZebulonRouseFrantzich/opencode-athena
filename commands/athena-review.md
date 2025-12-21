---
description: Run a combined quality gate on the current story implementation
---

# Athena Review - Quality Gate

Perform a comprehensive quality review combining BMAD methodology checks with oh-my-opencode quality tools.

## Step 1: Identify What to Review

Call **athena_get_story** to get the current story context:

```
athena_get_story()
```

## Step 2: Run Quality Checks

### Code Quality (oh-my-opencode style)

1. **LSP Diagnostics**: Check for errors and warnings
   - Use `lsp_diagnostics` on modified files
   - Address any errors before proceeding

2. **Comment Density**: Ensure code is not over-commented
   - AI-generated code should be indistinguishable from human code
   - Comments should explain "why", not "what"

3. **Code Structure**: Verify proper patterns
   - Use `ast_grep_search` to check for anti-patterns
   - Verify consistent naming conventions

### BMAD Methodology Checks

1. **Acceptance Criteria**: Verify ALL criteria from the story are met
   - List each criterion
   - Confirm implementation satisfies it

2. **Architecture Alignment**: Check against architecture.md
   - Verify correct patterns are used
   - Ensure no architectural violations

3. **Test Coverage**: Confirm tests exist and pass
   - Unit tests for new functionality
   - Integration tests if applicable

## Step 3: Generate Review Report

Provide a structured review with:
- Pass/Fail status for each check
- Specific issues found (if any)
- Recommendations for fixes

## Step 4: Update Status

If review passes:
```
athena_update_status({
  storyId: "<story ID>",
  status: "completed",
  completionSummary: "Review passed. All acceptance criteria met."
})
```

If review finds issues:
```
athena_update_status({
  storyId: "<story ID>",
  status: "in_progress",
  notes: "Review found issues: <list issues>"
})
```
