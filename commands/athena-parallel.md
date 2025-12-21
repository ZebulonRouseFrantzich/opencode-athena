---
description: Work on multiple stories in parallel using background agents
---

# Athena Parallel - Multi-Story Execution

Execute multiple BMAD stories simultaneously using background agents.

## When to Use This Command

- You have multiple independent stories to implement
- Stories are in different parts of the codebase
- You want to maximize throughput

## Prerequisites

- Multiple pending stories in sprint-status.yaml
- Stories should be independent (no dependencies between them)
- Context window must have capacity for coordination

## Step 1: Load Available Stories

```
athena_get_context({ includeSprintStatus: true })
```

Review the pending stories and identify which can run in parallel.

## Step 2: Start Parallel Execution

Use **athena_parallel** to kick off multiple stories:

```
athena_parallel({
  storyIds: ["2.1", "2.2", "2.3"],
  maxConcurrent: 3
})
```

This will:
1. Spawn background agents for each story
2. Coordinate to avoid conflicts
3. Report progress as each completes

## Step 3: Monitor Progress

Each story will:
- Load its own context
- Implement independently
- Update sprint-status.yaml on completion

You'll receive notifications as stories complete.

## Step 4: Review Results

When all parallel stories complete:
- Review the implementations
- Run combined tests
- Check for any integration issues

## Tips

- Start with 2 parallel stories to test the workflow
- Choose stories in different modules/directories
- Have one story be "primary" where you maintain focus
- Use background agents for the others

## Handling Conflicts

If stories conflict (editing same files):
- Background agents will detect the conflict
- They'll pause and request coordination
- You can resolve and restart the paused story
