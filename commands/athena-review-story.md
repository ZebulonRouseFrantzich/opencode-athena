---
description: 3-phase party review of BMAD stories with Oracle and BMAD agents
---

# Athena Review Story

Run a comprehensive party review of BMAD stories **before development** to catch security, logic, best practice, and performance gaps.

## Instructions

You receive: `$ARGUMENTS`

Parse the identifier from arguments (e.g., "2", "epic-2", "2.3", "story-2-3", or file path).

### Step 1: Phase 1 - Oracle Analysis

Call `athena_story_review_analyze` with the identifier:

```json
{
  "identifier": "{parsed_identifier}"
}
```

The tool spawns Oracle internally, analyzes stories, saves a review document, and returns findings with recommended BMAD agents.

If `success` is false, show the error and exit.

### Step 2: Present Summary and Get User Choice

Phase 1 returns a summary with `reviewFolderPath` pointing to the review folder. Store this path - all subsequent phases use it.

Display Phase 1 results:
- Finding counts by severity (high, medium, low)
- Finding counts by category (security, logic, best practices, performance)
- Review folder path (contains review.md and analysis.json)
- Recommended BMAD agents

Ask the user:
```
[Q] Quick review - Simple accept/defer/reject without agent discussion
[D] Discuss with team - Run parallel agent analysis + party discussion
[V] View full report - Show the review document
[E] Exit - End review session
```

### Step 3: Handle User Choice

**If [V]**: Read and display `{reviewFolderPath}/review.md`, then return to Step 2.

**If [E]**: Exit with message "Review saved to {reviewFolderPath}".

**If [Q]**: Call `athena_party_discussion` to start quick mode discussion:
```json
{
  "action": "start",
  "reviewFolderPath": "{phase1Result.reviewFolderPath}"
}
```
Skip to Step 5 (interactive discussion).

**If [D]**: Continue to Step 4.

### Step 4: Phase 2 - Parallel Agent Consultation

Call `athena_story_review_consult` with the review folder path:
```json
{
  "reviewFolderPath": "{phase1Result.reviewFolderPath}"
}
```

The tool loads Phase 1 data from analysis.json, spawns all recommended agents in parallel, waits for completion, synthesizes responses, saves Phase 2 results to phase2.json, and returns consensus/debate points.

Display Phase 2 summary (agents consulted, consensus points, debate points).

### Step 5: Phase 3 - Party Discussion

Call `athena_party_discussion` to start interactive discussion:

**Full mode** (after Phase 2 - phase2.json exists in folder):
```json
{
  "action": "start",
  "reviewFolderPath": "{phase1Result.reviewFolderPath}"
}
```

**Quick mode** (Phase 1 only - already called in Step 3)

For each agenda item:
1. Present the finding with agent perspectives
2. Ask user: [A]ccept / [D]efer / [R]eject / [S]kip
3. If [D]efer, ask for defer target:
   - Exact story ID (e.g., "4.5") - creates/appends to that story
   - "new story" - creates story at end of epic
   - "new story after X" (e.g., "new story after 4.2") - creates 4.2a
   - Existing story ID - appends to that story's Implementation Notes
4. Call `athena_party_discussion` with action "decide" (include `deferredTo` for defers) or "skip"
5. Call `athena_party_discussion` with action "continue" to get next item

When `hasMoreItems` is false, call `athena_party_discussion` with action "end" to finalize.

**The "end" action automatically applies all decisions:**
- Updates existing stories with accepted findings (adds acceptance criteria)
- Creates new stories for deferred findings (BMAD-compliant format)
- Appends to existing stories when deferring to them
- Updates sprint-status.yaml with new stories in correct order
- Generates decisions-applied.md summary document

## Done

Display the `appliedUpdates` from the "end" action result:
- Stories updated (count and paths)
- Stories created (count and paths)
- Stories appended to (count and paths)
- Any warnings (e.g., vague defer targets)
- Path to decisions-applied.md document

**Review complete!** All decisions have been applied to story files.
