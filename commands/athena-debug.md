---
description: Debug an issue using Oracle's deep reasoning capabilities
---

# Athena Debug - Oracle-Powered Debugging

Use Oracle, the debugging specialist, to analyze and fix complex issues with systematic hypothesis-driven debugging.

**You are Sisyphus, the orchestrator.** You will coordinate Oracle's deep reasoning with automated tools to efficiently diagnose and fix issues.

## When to Use This Command

- Complex bugs that span multiple files
- Performance issues requiring deep analysis
- Architectural problems needing strategic solutions
- Issues where the root cause is unclear
- Bugs you've tried to fix 2+ times without success

## Step 1: Gather Context

### 1.1 Check Story Context (if applicable)

If debugging during story implementation, load the story context first:

```
athena_get_story()
```

This provides:
- Acceptance criteria (to understand expected behavior)
- Architecture patterns (to understand design intent)
- Related code context

### 1.2 Collect Error Evidence

Before invoking Oracle, gather all available evidence:

**Error messages and stack traces:**
- Copy the exact error message
- Include the full stack trace if available
- Note which file/line the error points to

**Reproduction information:**
- Steps to reproduce the issue
- Input values that trigger the error
- Environment details (dev/prod, browser, etc.)

**What you've already tried:**
- Previous fix attempts
- Why they didn't work
- Any patterns you've noticed

### 1.3 Use Explore for Initial Context (Optional but Recommended)

Before invoking expensive Oracle, use **@explore** to gather codebase context:

```
@explore I'm debugging an issue in {area of code}.

The error is: {error message}
The problematic behavior is: {description}

Please find:
1. The code paths related to this functionality
2. Similar error handling in the codebase
3. Any related tests that might indicate expected behavior
4. Recent changes to these files (if visible)

Return file paths and relevant code sections.
```

**When to skip Explore:**
- You already know exactly where the bug is
- You've already traced the code path
- The issue is architectural, not code-specific

## Step 2: Invoke Oracle for Diagnosis

Ask **@oracle** to perform systematic debugging:

```
@oracle I need help debugging a complex issue.

## Problem Description

**Expected Behavior:**
{what should happen}

**Actual Behavior:**
{what happens instead}

**Error Message/Stack Trace:**
```
{paste exact error}
```

**Reproduction Steps:**
1. {step 1}
2. {step 2}
3. {step 3}

## Context

**Affected Files:**
{list files involved - from Explore or your knowledge}

**Architecture Context:**
{relevant architecture patterns if from story context}

**What I've Already Tried:**
- {attempt 1 and why it failed}
- {attempt 2 and why it failed}

## Debugging Request

Please analyze this issue using your systematic debugging approach:

1. **Evidence Analysis**: Review the error, stack trace, and context
2. **Hypothesis Generation**: List 3-5 possible root causes ranked by likelihood
3. **Hypothesis Testing**: For each hypothesis, describe how to test/verify it
4. **Root Cause Identification**: Based on testing, identify the most likely root cause
5. **Solution Design**: Propose a fix that addresses the root cause
6. **Risk Assessment**: Identify any side effects or risks of the proposed fix

Do NOT implement the fix yet. First, present your analysis and get confirmation.
```

## Step 3: Review Oracle's Analysis

Oracle will provide:

1. **Hypotheses** - Ranked list of possible root causes
2. **Evidence Mapping** - How each hypothesis explains the observed behavior
3. **Testing Plan** - How to verify/eliminate each hypothesis
4. **Recommended Root Cause** - The most likely cause based on analysis
5. **Proposed Fix** - Solution design

### 3.1 Validate the Analysis

Before proceeding with the fix:

- Does the root cause explain ALL the symptoms?
- Does the proposed fix address the root cause (not just symptoms)?
- Are there any risks or side effects?

### 3.2 Request Implementation

If you agree with Oracle's analysis:

```
@oracle Your analysis looks correct. Please implement the fix you proposed.

Specifically:
- {any additional constraints}
- {any files to avoid modifying}
- {any patterns to follow}

After implementing, show me what changed and explain how it fixes the root cause.
```

If you disagree or need more investigation:

```
@oracle I have concerns about hypothesis #{N}.

{explain your concern}

Please investigate further:
- {specific thing to check}
- {alternative hypothesis to consider}
```

## Step 4: Verify the Fix

### 4.1 Run Automated Checks

After Oracle implements the fix:

**Run LSP diagnostics on modified files:**

```
lsp_diagnostics(filePath: "<modified file>", severity: "all")
```

**Run the build (if applicable):**

```bash
npm run build
```

**Run tests (if applicable):**

```bash
npm test
```

### 4.2 Reproduce the Original Issue

Try to reproduce the original bug:

- Follow the same reproduction steps
- Use the same input values
- Verify the error no longer occurs

### 4.3 Check for Regressions

- Does existing functionality still work?
- Do related tests still pass?
- Are there any new errors or warnings?

## Step 5: Document and Update Status

### 5.1 Document the Fix

Record what was learned:

```markdown
## Debug Summary

**Issue:** {brief description}
**Root Cause:** {what Oracle identified}
**Fix Applied:** {what was changed}
**Files Modified:** {list of files}
**Verification:** {how it was verified}
```

### 5.2 Update Story Status (if applicable)

If debugging was part of a story:

**If fix is complete and story can continue:**
```
athena_update_status({
  storyId: "<story ID>",
  status: "in_progress",
  notes: "Debug complete. Root cause: {cause}. Fixed by: {fix}. Continuing implementation."
})
```

**If issue was blocking and is now resolved:**
```
athena_update_status({
  storyId: "<story ID>",
  status: "in_progress",
  notes: "Blocker resolved. Issue was {root cause}. Fixed by {solution}."
})
```

**If issue requires external help:**
```
athena_update_status({
  storyId: "<story ID>",
  status: "blocked",
  notes: "Debug identified issue but fix requires {external dependency/decision}. Root cause: {cause}."
})
```

## Oracle's Debugging Methodology

Oracle uses a systematic approach:

```
┌─────────────────────────────────────────────────────────┐
│                   GATHER EVIDENCE                        │
│  Collect error messages, stack traces, reproduction     │
│  steps, and context from affected code                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 FORM HYPOTHESES                          │
│  Generate 3-5 possible root causes, ranked by           │
│  likelihood based on evidence                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 TEST HYPOTHESES                          │
│  For each hypothesis, identify how to verify or         │
│  eliminate it using tools and code analysis             │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              IDENTIFY ROOT CAUSE                         │
│  Based on testing, determine the most likely            │
│  root cause that explains all symptoms                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 IMPLEMENT FIX                            │
│  Design and implement a solution that addresses         │
│  the root cause (not just symptoms)                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    VERIFY                                │
│  Confirm fix resolves the issue without                 │
│  introducing regressions                                │
└─────────────────────────────────────────────────────────┘
```

## Tips for Effective Debugging

### Provide Complete Context

- **Include full error messages** - Don't paraphrase, copy exactly
- **Include stack traces** - The call stack reveals the code path
- **Show the problematic code** - Oracle needs to see what's happening
- **Describe reproduction steps** - How to trigger the bug

### Don't Jump to Solutions

- Let Oracle analyze before implementing
- Review Oracle's hypotheses critically
- Confirm root cause before fixing

### Verify Thoroughly

- The bug should be gone after the fix
- Nothing else should break
- Tests should pass

### Cost Awareness

- **Oracle is expensive** (GPT-5.2 deep reasoning)
- Use Explore first for context gathering (cheaper)
- Only invoke Oracle for genuinely complex bugs
- Simple bugs (typos, obvious errors) don't need Oracle

## When NOT to Use This Command

- **Simple syntax errors** - LSP diagnostics will catch these
- **Obvious bugs** - If you can see the issue, just fix it
- **Configuration issues** - Check docs first
- **First attempt at fixing** - Try yourself first, use Oracle after 2+ failures
