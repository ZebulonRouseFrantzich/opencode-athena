---
description: 3-phase party review of BMAD stories with parallel agent analysis and informed discussion
---

# Athena Review Story - Enhanced Party Review (3-Phase)

Run a comprehensive "party review" on BMAD stories **after story creation but before development**.

**Architecture:**
- **Phase 1**: Background agent performs Oracle analysis (saves context)
- **Phase 2**: Parallel BMAD agents analyze from their perspectives
- **Phase 3**: Athena-orchestrated informed discussion with pre-informed agents

---

## Phase 1: Automated Review (Background Agent)

### Step 1.1: Parse Arguments

The command receives: `$ARGUMENTS`

**Scope Detection:**
- Epic: `2`, `epic-2` → Reviews all stories in epic
- Story: `2.3`, `story-2-3` → Deep dive on single story
- Path: `docs/stories/story-2-3.md` → Explicit file
- Flag: `--thorough` → Force advanced model

### Step 1.2: Spawn Background Review Agent

This review runs in a **separate context** to preserve main session tokens.

```
Use background_task to spawn a review agent:

background_task({
  agent: "oracle",
  description: "Party review of {identifier}",
  prompt: `
You are performing a party review for Athena.

1. Call the athena_review_story tool:
   athena_review_story({ identifier: "{identifier}", thorough: {thorough} })

2. Using the oraclePrompt from the result, invoke @oracle to analyze the stories.

3. Parse Oracle's response and count findings by category and severity.

4. Determine which BMAD agents should participate based on findings:
   - Security issues → Architect (Winston), DEV (Amelia), TEA (Murat)
   - Logic gaps → Analyst (Mary), DEV (Amelia), TEA (Murat)
   - Performance issues → Architect (Winston), DEV (Amelia)
   - Best practices → DEV (Amelia), Tech Writer (Paige)
   - High severity issues → PM (John) always required

5. Save the review document to: docs/reviews/party-review-{scope}-{identifier}-{date}.md

6. Return a JSON summary:
   {
     "success": true,
     "scope": "epic|story",
     "identifier": "...",
     "reviewDocumentPath": "...",
     "findings": {
       "total": N,
       "high": N,
       "medium": N,
       "low": N,
       "byCategory": { "security": N, "logic": N, "bestPractices": N, "performance": N }
     },
     "recommendedAgents": [
       { "agent": "architect", "reason": "...", "priority": "required|recommended|optional" },
       ...
     ],
     "oracleAnalysis": "..." 
   }
`
})
```

### Step 1.3: Wait for Background Result

Wait for the background task to complete and retrieve the Phase 1 result.

```
background_output({ task_id: "<task_id_from_step_1.2>" })
```

### Step 1.4: Present Summary to User

```
📋 **Phase 1 Complete: Automated Review**

**Scope**: {Epic/Story} {identifier}
**Review Document**: {reviewDocumentPath}

**Findings Summary**:
- 🔴 High: {high} issues (must address)
- 🟡 Medium: {medium} issues (should address)
- 🟢 Low: {low} issues (nice to have)

**By Category**:
- 🔒 Security: {security}
- 🧠 Logic: {logic}
- ✨ Best Practices: {bestPractices}
- ⚡ Performance: {performance}

**Recommended BMAD Agents for Discussion**:
{list recommended agents with reasons}

---

**Options**:
[Q] Quick review - Accept/Defer/Reject findings without discussion
[D] Discuss with team - Launch Phase 2 parallel analysis + Phase 3 party discussion
[V] View full report - Open the review document
[E] Exit - End review session
```

**If user selects [Q]**: Skip to Quick Decision Flow (below)
**If user selects [D]**: Continue to Phase 2
**If user selects [V]**: Display the review document, then return to options
**If user selects [E]**: End session

---

## Phase 2: Parallel Agent Pre-Analysis

When user selects [D], spawn parallel background agents for each recommended BMAD agent.

### Step 2.1: Spawn Parallel Agent Analyses

For each recommended agent, spawn a background task:

```
# Spawn in parallel - all at once
background_task({
  agent: "oracle",
  description: "Architect analysis of {identifier}",
  prompt: `
You are Winston, the Software Architect from BMAD.

**Your Expertise**: System design, security architecture, scalability, technical debt
**Your Perspective**: Architecture and system design implications

**Review the following stories and findings**:
{storiesContent}

**Oracle's Findings**:
{oracleAnalysis}

**Your Task**:
1. Analyze each finding from your architecture perspective
2. Identify any cross-story patterns (shared components, dependencies)
3. Prioritize issues based on architectural impact
4. Note any findings you agree with, disagree with, or want to add to

**Return JSON**:
{
  "agent": "architect",
  "perspective": "architecture and system design",
  "findings": {
    "agreements": ["I agree with finding X because..."],
    "concerns": ["From an architecture view, Y is concerning because..."],
    "suggestions": ["Consider also addressing Z..."]
  },
  "crossStoryPatterns": [
    { "pattern": "...", "affectedStories": ["2.1", "2.3"], "recommendation": "..." }
  ],
  "prioritizedIssues": [
    { "findingId": "...", "priority": "critical|important|minor", "rationale": "..." }
  ],
  "summary": "Brief 2-3 sentence summary of my analysis"
}
`
})

# Similar for DEV (Amelia), TEA (Murat), PM (John), etc.
```

### Step 2.2: Collect All Agent Analyses

```
# Wait for all parallel tasks
architect_result = background_output({ task_id: "..." })
dev_result = background_output({ task_id: "..." })
tea_result = background_output({ task_id: "..." })
pm_result = background_output({ task_id: "..." })
```

### Step 2.3: Synthesize Agent Perspectives

Combine all agent analyses into a discussion context:

```
**Agent Analysis Summary**:

**Consensus Points** (agents agree):
- {list points where multiple agents agree}

**Debate Points** (agents disagree):
- {topic}: 
  - Winston (Architect): {position}
  - Amelia (DEV): {different position}

**Priority Votes**:
| Finding | Architect | DEV | TEA | PM | Consensus |
|---------|-----------|-----|-----|----|-----------| 
| SEC-001 | Critical  | Critical | Important | Critical | Strong |
| LOG-002 | Minor     | Important | Critical | Important | Disputed |
```

---

## Phase 3: Informed Discussion (Athena Party Discussion)

### Step 3.1: Start Party Discussion

Initialize the party discussion with Phase 1 and Phase 2 results:

```
athena_party_discussion({
  action: "start",
  phase1Result: JSON.stringify(phase1Result),
  phase2Result: JSON.stringify(phase2Result)
})
```

This returns:
- `sessionId` - Use this for subsequent calls
- `currentItem` - First agenda item to discuss
- `currentResponses` - Agent responses for the current item
- `hasMoreItems` - Whether there are more items to discuss

### Step 3.2: Present Finding and Agent Responses

For each agenda item, display:

```
🎉 **Party Discussion: {currentItem.topic}**

**Severity**: {currentItem.severity} | **Category**: {currentItem.category}
**Type**: {currentItem.type}

---

**Agent Perspectives:**

{For each response in currentResponses:}
{response.icon} **{response.agentName}**: {response.response}

---

**Your Decision:**
[A] Accept - Add to acceptance criteria
[D] Defer - Move to another story
[R] Reject - Won't address
[S] Skip - Discuss later
[N] Next - Continue to next finding without deciding
```

### Step 3.3: Record User Decision

When user decides:

```
athena_party_discussion({
  action: "decide",
  sessionId: "{sessionId}",
  findingId: "{currentItem.findingId}",
  decision: "accept|defer|reject",
  reason: "{optional reason from user}",
  deferredTo: "{story ID if deferred}"
})
```

If user selects Skip:
```
athena_party_discussion({
  action: "skip",
  sessionId: "{sessionId}",
  findingId: "{currentItem.findingId}"
})
```

### Step 3.4: Continue or Complete

If `hasMoreItems` is true:
```
athena_party_discussion({
  action: "continue",
  sessionId: "{sessionId}"
})
```

Display the next finding and repeat Step 3.2.

If `hasMoreItems` is false, the tool returns a summary:

```
📋 **Discussion Complete**

**Decisions Made**:
- ✅ Accepted: {summary.decisions.accepted} findings
- ⏸️ Deferred: {summary.decisions.deferred} findings
- ❌ Rejected: {summary.decisions.rejected} findings
- ⏳ Pending: {summary.decisions.pending} findings

**Stories to Update**:
{For each in summary.storyUpdatesNeeded:}
- Story {storyId}: {additions.length} items to add

Would you like me to update the story files now? [Y/N]
```

### Step 3.5: Apply Story Updates

If user confirms, the story files will be updated with:
- New acceptance criteria for accepted findings
- Implementation notes for all decisions
- Updated review document with decision log

End the session:
```
athena_party_discussion({
  action: "end",
  sessionId: "{sessionId}"
})
```

---

## Quick Decision Flow

If user selected [Q] in Phase 1, skip Phases 2-3 and go directly to decisions:

```
Let's go through the findings quickly.

🔴 **HIGH SEVERITY** ({count}):

1. [{category}] {title}
   Impact: {impact}
   Suggestion: {suggestion}
   
   [A]ccept / [D]efer / [R]eject? 

{Continue for each finding}

---

Summary:
- Accepted: {count}
- Deferred: {count}  
- Rejected: {count}

Update stories now? [Y/N]
```

---

## Story Update Flow

After decisions are captured:

1. Load each affected story file
2. Add new acceptance criteria for accepted findings
3. Add notes for deferred items (with target)
4. Update the review document with decisions
5. Report completion

```
✅ **Updates Complete**

**Modified Files**:
- docs/stories/story-2-1.md (added 2 ACs)
- docs/stories/story-2-3.md (added 1 AC, 1 note)
- docs/reviews/party-review-epic-2-2025-12-23.md (decisions recorded)

🚀 Stories are ready for development!
```

---

## Usage Examples

```bash
# Epic review with full 3-phase workflow
/athena-review-story epic-2

# Story review (focused)
/athena-review-story 2.3

# Force thorough analysis
/athena-review-story 2.3 --thorough
```

---

## Tips

- **Phase 1 runs in background** - Your main session stays responsive
- **Phase 2 agents run in parallel** - Faster than sequential analysis
- **Phase 3 uses Athena's informed discussion** - Agents pre-informed by Phase 2 analysis
- **Skip to quick review** for simple stories with few findings
- **Use --thorough** for security-critical or complex stories
