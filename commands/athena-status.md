---
description: View and manage BMAD sprint status
---

# Athena Status - Sprint Status Management

## Git Operations Policy

**⚠️ AUTOMATIC GIT OPERATIONS ARE PROHIBITED**

You must NOT perform any git operations automatically:
- ❌ Do NOT run `git commit` to save changes
- ❌ Do NOT run `git push` to push to remote
- ❌ Do NOT run `git checkout -b` or `git branch` to create branches
- ❌ Do NOT run `git merge`, `git rebase`, or `git cherry-pick`
- ❌ Do NOT run `gh pr create` or other GitHub CLI operations

**Git operations are ONLY permitted if the user explicitly requests them.**

This command focuses on status management and should not involve git operations.

---

View current sprint progress and manage story statuses. This command helps you track where you are in the sprint and what to work on next.

## Quick Status Check

Get an overview of the current sprint:

```
athena_get_story()
```

This returns:
- **Current Story**: The story you're working on (if any)
- **Sprint Progress**: Completed, in-progress, pending, blocked counts
- **Next Story**: The next story to work on
- **Epic Context**: Which epic the current work belongs to

## Sprint Overview

When you call `athena_get_story()`, review the sprint progress:

```markdown
## Sprint Progress Example

Epic: User Authentication (Epic 2)
- Completed: 3 stories (2.1, 2.2, 2.3)
- In Progress: 1 story (2.4) ← Current
- Pending: 2 stories (2.5, 2.6)
- Blocked: 0 stories
- Progress: 50% complete
```

## Story Status Management

### Start Working on a Story

When you begin implementing a story:

```
athena_update_status({
  storyId: "2.4",
  status: "in_progress"
})
```

**When to use:**
- Starting a new story from `/athena-dev`
- Resuming work after a break
- Moving from blocked to in-progress

### Complete a Story

When implementation is done and verified:

```
athena_update_status({
  storyId: "2.4",
  status: "completed",
  completionSummary: "Implemented OAuth2 login flow with Google and GitHub providers. Added token refresh mechanism. All tests passing."
})
```

**Requirements for completion:**
- ✅ All acceptance criteria met
- ✅ LSP diagnostics clean
- ✅ Build passes
- ✅ Tests pass
- ✅ Code follows architecture patterns

**Best Practices for completionSummary:**
- Be specific about what was built
- Mention key components or files
- Note test status
- Include any notable decisions or trade-offs

### Block a Story

When you can't proceed due to an external dependency:

```
athena_update_status({
  storyId: "2.4",
  status: "blocked",
  notes: "Blocked on API credentials. Need OAuth client ID and secret from DevOps team. ETA unknown."
})
```

**When to block:**
- Waiting for external team or resource
- Missing design/specification clarity
- Dependency on another incomplete story
- Technical blocker requiring decision

**Best Practices for notes:**
- Explain what's blocking you
- What you need to unblock
- Who can provide it
- Any workarounds attempted

### Request Review

When ready for code review or QA:

```
athena_update_status({
  storyId: "2.4",
  status: "needs_review"
})
```

**When to request review:**
- Implementation complete but not verified
- Want another pass before marking complete
- Before running `/athena-review` quality gate

## Workflow Integration

### Recommended Sprint Workflow

```
┌──────────────────────────────────────────────────────────────┐
│  1. CHECK STATUS                                              │
│     /athena-status → See sprint progress, identify next      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  2. START IMPLEMENTATION                                      │
│     /athena-dev → Load story, plan, implement                │
│     Status: pending → in_progress                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  3. QUALITY GATE (Optional but Recommended)                   │
│     /athena-review → Oracle code review + adversarial review │
│     Status: in_progress → needs_review → completed/in_progress│
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  4. COMPLETE & NEXT                                           │
│     /athena-status → Verify completion, see next story       │
│     Status: in_progress → completed                          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    Repeat for next story
```

### Command Quick Reference

| Situation | Command | Purpose |
|-----------|---------|---------|
| See sprint progress | `/athena-status` | Get overview and next story |
| Start implementing | `/athena-dev` | Load story and implement |
| Need research | `/athena-research` | Find patterns and docs |
| Hit a complex bug | `/athena-debug` | Oracle-powered debugging |
| Ready to complete | `/athena-review` | Quality gate before completion |
| View config | `/athena-info` | Check toolkit settings |

## Status Transitions

### Valid Status Flow

```
pending ──────┬─────────────────────────────────────────┐
              │                                          │
              ▼                                          │
         in_progress ◄──────────────────────────┐       │
              │                                  │       │
              ├──────► blocked ─────────────────┘       │
              │            │                            │
              │            └────────────────────────────┘
              │                 (when unblocked)
              │
              ├──────► needs_review ────────────┐
              │                                  │
              │                                  ▼
              └──────────────────────────► completed
```

### Status Definitions

| Status | Meaning | Next Actions |
|--------|---------|--------------|
| **pending** | Not yet started | Start with `/athena-dev` |
| **in_progress** | Actively being worked on | Continue implementation |
| **blocked** | Waiting for external dependency | Resolve blocker, then resume |
| **needs_review** | Ready for review | Run `/athena-review` |
| **completed** | Done and verified | Move to next story |

## Handling Special Cases

### Resuming After Interruption

If you return to a story after a break:

```
# Check current state
athena_get_story()

# If status is in_progress, continue
# If status is pending, start fresh with /athena-dev
```

### Story Dependencies

If Story B depends on Story A:

```
# Check if Story A is complete
athena_get_story({ storyId: "A" })

# If not complete, work on A first
# If complete, proceed with B
```

### Blocked Resolution

When a blocker is resolved:

```
athena_update_status({
  storyId: "2.4",
  status: "in_progress",
  notes: "Blocker resolved. Received API credentials from DevOps. Resuming implementation."
})
```

### Reassessing Completion

If issues are found after marking complete:

```
athena_update_status({
  storyId: "2.4",
  status: "in_progress",
  notes: "Reopened: Found edge case not covered. Need to add handling for empty input."
})
```

## Sprint Health Indicators

When reviewing sprint status, watch for:

### Healthy Sprint
- ✅ Stories completing regularly
- ✅ Few or no blocked stories
- ✅ Clear next story identified
- ✅ Progress percentage increasing

### Warning Signs
- ⚠️ Multiple stories blocked
- ⚠️ Story in_progress for too long
- ⚠️ No progress for extended time
- ⚠️ Blockers not getting resolved

### Actions for Warning Signs

| Warning | Action |
|---------|--------|
| Multiple blocked stories | Escalate blockers, prioritize resolution |
| Story stuck in_progress | Break into smaller tasks, ask for help |
| No progress | Check for hidden blockers, reassess scope |
| Blockers aging | Follow up with responsible parties |

## Tips

- **Check status regularly** - Start each session with `/athena-status`
- **Update status honestly** - Accurate status helps track progress
- **Include context** - Good notes help when resuming later
- **Complete incrementally** - Mark stories done as they finish, not in batches
- **Don't skip reviews** - Use `/athena-review` for quality assurance
