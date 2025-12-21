---
description: Debug an issue using Oracle's deep reasoning capabilities
---

# Athena Debug - Oracle-Powered Debugging

Use Oracle, the debugging specialist, to analyze and fix complex issues.

## When to Use This Command

- Complex bugs that span multiple files
- Performance issues requiring deep analysis
- Architectural problems needing strategic solutions
- Issues where the root cause is unclear

## Step 1: Describe the Problem

Provide:
- What behavior you expected
- What behavior you observed
- Steps to reproduce (if known)
- Any error messages or stack traces

## Step 2: Invoke Oracle

Oracle will:
1. Analyze the problem description
2. Search the codebase for relevant code
3. Form hypotheses about root causes
4. Test hypotheses systematically
5. Propose and implement fixes

### Oracle's Approach

Oracle uses a methodical debugging strategy:
- **Gather Evidence**: Collect all relevant information
- **Form Hypotheses**: Generate possible root causes
- **Test Hypotheses**: Use tools to verify or eliminate each
- **Implement Fix**: Once root cause is found, implement solution
- **Verify**: Ensure the fix resolves the issue without regressions

## Step 3: Apply the Fix

Oracle will implement the fix and explain:
- What the root cause was
- Why the fix works
- Any side effects to watch for

## Step 4: Update Story Status (if applicable)

If debugging was blocking a story:
```
athena_update_status({
  storyId: "<story ID>",
  status: "in_progress",
  notes: "Debug complete. Issue was <root cause>. Fixed by <solution>."
})
```
