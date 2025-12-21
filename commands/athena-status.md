---
description: View and manage BMAD sprint status
---

# Athena Status - Sprint Status Management

View and manage the current sprint status.

## View Current Status

Get an overview of the current sprint:

```
athena_get_context({ includeSprintStatus: true })
```

This will show:
- Current sprint number and epic
- Completed stories (with completion summaries)
- In-progress stories
- Pending stories
- Blocked stories (with blockers)

## Update Story Status

### Start a Story
```
athena_update_status({
  storyId: "2.1",
  status: "in_progress"
})
```

### Complete a Story
```
athena_update_status({
  storyId: "2.1",
  status: "completed",
  completionSummary: "Implemented user authentication flow with OAuth2."
})
```

### Block a Story
```
athena_update_status({
  storyId: "2.1",
  status: "blocked",
  notes: "Waiting for API credentials from infrastructure team."
})
```

### Request Review
```
athena_update_status({
  storyId: "2.1",
  status: "needs_review"
})
```

## Sprint Progress

The response will include sprint progress:
- Completed: X stories
- In Progress: Y stories
- Pending: Z stories
- Blocked: N stories
- Percent Complete: XX%

## Next Story

After completing a story, the response includes the next suggested story to work on.
