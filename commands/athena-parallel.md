---
description: Work on multiple stories in parallel using background agents
---

# Athena Parallel - Multi-Story Execution

> **⚠️ NOT YET IMPLEMENTED**
> 
> This command describes **planned functionality** that is not yet available. The `athena_parallel` tool is a placeholder. This document describes the intended behavior for future implementation.

## Git Operations Policy

**⚠️ AUTOMATIC GIT OPERATIONS ARE PROHIBITED**

You must NOT perform any git operations automatically:
- ❌ Do NOT run `git commit` to save changes
- ❌ Do NOT run `git push` to push to remote
- ❌ Do NOT run `git checkout -b` or `git branch` to create branches
- ❌ Do NOT run `git merge`, `git rebase`, or `git cherry-pick`
- ❌ Do NOT run `gh pr create` or other GitHub CLI operations

**Git operations are ONLY permitted if the user explicitly requests them.**

When working on multiple stories in parallel, git operations become especially important to coordinate manually. Always ask the user before performing any git operations.

---

Execute multiple BMAD stories simultaneously using background agents for maximum throughput.

## Planned Behavior

### When to Use This Command

- Multiple independent stories in the sprint backlog
- Stories work on different parts of the codebase (no file conflicts)
- You want to maximize development throughput
- Stories have no dependencies on each other

### Prerequisites

- Multiple pending stories in `sprint-status.yaml`
- Stories must be independent (no blocking dependencies)
- Stories should not modify the same files
- Sufficient context window capacity for coordination

## Planned Workflow

### Step 1: Check Sprint Status

First, view available stories:

```
athena_get_story()
```

Identify stories that can safely run in parallel:
- ✅ Different modules or directories
- ✅ No shared file modifications
- ✅ No data dependencies
- ❌ Avoid stories that modify the same files

### Step 2: Analyze for Conflicts (Planned)

The `athena_parallel` tool will analyze stories for potential conflicts:

```
athena_parallel({
  storyIds: ["2.1", "2.2", "2.3"],
  dryRun: true  // Just check for conflicts, don't execute
})
```

**Planned conflict detection:**
- Parse story requirements for file paths mentioned
- Check architecture.md for overlapping components
- Identify shared dependencies
- Report potential conflicts before execution

### Step 3: Execute in Parallel (Planned)

```
athena_parallel({
  storyIds: ["2.1", "2.2", "2.3"],
  waitForCompletion: false  // Return immediately, run in background
})
```

**Planned execution flow:**
1. Validate no conflicts between selected stories
2. Mark all stories as `in_progress` in `sprint-status.yaml`
3. Spawn background agent for each story
4. Each agent runs `/athena-dev` workflow independently
5. Coordinate to prevent concurrent file modifications
6. Report completion as each story finishes

### Step 4: Monitor Progress (Planned)

**Planned monitoring capabilities:**

```
athena_parallel({
  action: "status"
})
```

Returns:
- Which stories are running
- Progress of each background agent
- Any conflicts or blockers encountered
- Estimated completion time

### Step 5: Handle Completion (Planned)

When stories complete:
- `sprint-status.yaml` updated automatically
- Notification sent for each completion
- Combined test run suggested
- Integration check recommended

## Planned Features

### Conflict Prevention

| Conflict Type | Detection | Resolution |
|---------------|-----------|------------|
| Same file edits | Pre-execution analysis | Reject parallel execution |
| Shared dependencies | Architecture analysis | Sequential for conflict area |
| Data dependencies | Story requirement parsing | Enforce story order |

### Coordination Strategies (Planned)

**File-level locking:**
- First agent to touch a file gets exclusive access
- Other agents wait if they need the same file

**Module-level partitioning:**
- Assign stories to non-overlapping code areas
- Detect boundary violations

**Merge coordination:**
- If conflicts occur, pause and notify
- User resolves manually or chooses which version wins

### Configuration (Planned)

```json
// athena.json
{
  "parallel": {
    "maxConcurrentStories": 3,
    "conflictStrategy": "prevent", // or "coordinate" or "manual"
    "notifyOnComplete": true,
    "autoRunTests": true
  }
}
```

## Current Workaround

Until `athena_parallel` is implemented, you can achieve similar results manually:

### Manual Parallel Workflow

**1. Open multiple terminal sessions:**

```bash
# Terminal 1 - Primary story (your focus)
opencode
# Run /athena-dev for story 2.1

# Terminal 2 - Background story
opencode  
# Run /athena-dev for story 2.2
```

**2. Or use background agents within single session:**

```
# Start story 2.1 in background
background_task({
  agent: "general",
  prompt: "Implement BMAD story 2.1. Load context with athena_get_story({storyId: '2.1'}), implement following /athena-dev workflow, update status when complete.",
  description: "Story 2.1 implementation"
})

# Work on story 2.2 yourself
/athena-dev 2.2
```

**3. Coordinate manually:**

- Keep track of which files each story modifies
- Avoid parallel work on same files
- Run combined tests after both complete
- Check for integration issues

## Design Considerations for Implementation

### Background Agent Integration

The planned implementation will use oh-my-opencode's background agent system:

```typescript
// Conceptual implementation
async function executeParallel(storyIds: string[]) {
  // 1. Validate no conflicts
  const conflicts = await detectConflicts(storyIds);
  if (conflicts.length > 0) {
    return { error: "Conflicts detected", conflicts };
  }
  
  // 2. Mark all as in_progress
  for (const id of storyIds) {
    await updateSprintStatus(id, "in_progress");
  }
  
  // 3. Spawn background agents
  const tasks = storyIds.map(id => ({
    agent: "general", // or dedicated story-impl agent
    prompt: generateStoryPrompt(id),
  }));
  
  // 4. Launch and track
  const results = await backgroundManager.launchMany(tasks);
  
  return { launched: results.length, taskIds: results.map(r => r.id) };
}
```

### Conflict Detection Strategy

```typescript
// Conceptual conflict detection
async function detectConflicts(storyIds: string[]) {
  const storyFiles: Map<string, string[]> = new Map();
  
  for (const id of storyIds) {
    const story = await loadStory(id);
    const files = extractMentionedFiles(story);
    const architectureFiles = extractArchitectureFiles(story);
    storyFiles.set(id, [...files, ...architectureFiles]);
  }
  
  // Find overlapping files
  const conflicts = [];
  for (const [id1, files1] of storyFiles) {
    for (const [id2, files2] of storyFiles) {
      if (id1 >= id2) continue;
      const overlap = files1.filter(f => files2.includes(f));
      if (overlap.length > 0) {
        conflicts.push({ stories: [id1, id2], files: overlap });
      }
    }
  }
  
  return conflicts;
}
```

## Limitations

Even when implemented:

- **Context limits**: Each background agent uses context window
- **Coordination overhead**: Managing multiple agents has overhead
- **Conflict resolution**: Some conflicts require human judgment
- **Testing complexity**: Parallel changes complicate testing

## Tips for Future Use

- **Start small**: Test with 2 stories before scaling up
- **Choose wisely**: Pick stories in truly independent areas
- **Monitor actively**: Check progress regularly
- **Test together**: Run full test suite after parallel completion
- **Review carefully**: Parallel work may have subtle integration issues

## Related Commands

| Command | Use When |
|---------|----------|
| `/athena-dev` | Single story implementation |
| `/athena-status` | Check sprint status and pending stories |
| `/athena-review` | Quality gate after parallel completion |
