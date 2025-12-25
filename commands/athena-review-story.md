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

Display Phase 1 results:
- Finding counts by severity (high, medium, low)
- Finding counts by category (security, logic, best practices, performance)
- Review document path
- Recommended BMAD agents

Ask the user:
```
[Q] Quick review - Simple accept/defer/reject without agent discussion
[D] Discuss with team - Run parallel agent analysis + party discussion
[V] View full report - Show the review document
[E] Exit - End review session
```

### Step 3: Handle User Choice

**If [V]**: Read and display the review document, then return to Step 2.

**If [E]**: Exit with message "Review document saved to {path}".

**If [Q]**: Call `athena_party_discussion` with only Phase 1 results (quick mode):
```json
{
  "action": "start",
  "phase1Result": "{JSON.stringify(phase1Result)}"
}
```
Skip to Step 5 (interactive discussion).

**If [D]**: Continue to Step 4.

### Step 4: Phase 2 - Parallel Agent Consultation

Call `athena_story_review_consult` with Phase 1 results:
```json
{
  "phase1Result": "{JSON.stringify(phase1Result)}"
}
```

The tool spawns all recommended agents in parallel, waits for completion, synthesizes responses, and returns consensus/debate points.

Display Phase 2 summary (agents consulted, consensus points, debate points).

### Step 5: Phase 3 - Party Discussion

Call `athena_party_discussion` to start interactive discussion:

**Full mode** (with Phase 2):
```json
{
  "action": "start",
  "phase1Result": "{JSON.stringify(phase1Result)}",
  "phase2Result": "{JSON.stringify(phase2Result)}"
}
```

**Quick mode** (Phase 1 only - already called in Step 3):
```json
{
  "action": "start",
  "phase1Result": "{JSON.stringify(phase1Result)}"
}
```

For each agenda item:
1. Present the finding with agent perspectives
2. Ask user: [A]ccept / [D]efer / [R]eject / [S]kip
3. Call `athena_party_discussion` with action "decide" or "skip"
4. Call `athena_party_discussion` with action "continue" to get next item

When `hasMoreItems` is false, display final summary:
- Decisions made (accepted, deferred, rejected, skipped)
- Stories that need updates

Call `athena_party_discussion` with action "end" to finalize.

## Done

Review complete! Stories are ready for development.
