---
description: 3-phase party review of BMAD stories with parallel agent analysis and BMAD party-mode discussion
---

# Athena Review Story - Enhanced Party Review (3-Phase)

Run a comprehensive "party review" on BMAD stories **after story creation but before development**.

**Architecture:**
- **Phase 1**: Background agent performs Oracle analysis (saves context)
- **Phase 2**: Parallel BMAD agents analyze from their perspectives
- **Phase 3**: BMAD party-mode discussion with pre-informed agents

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
[D] Discuss with team - Launch Phase 2 parallel analysis + Phase 3 party mode
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

## Phase 3: Informed Discussion (BMAD Party Mode)

### Step 3.1: Prepare Party Mode Context

Create a context document for party mode:

```markdown
# Party Review Discussion: {identifier}

**Date**: {date}
**Phase 1 Findings**: {total} issues ({high} high, {medium} medium, {low} low)
**Agents Present**: {list of agents}

## Pre-Analysis Summaries

### Winston (Architect)
{architect summary}

### Amelia (DEV)  
{dev summary}

### Murat (TEA)
{tea summary}

### John (PM)
{pm summary}

## Discussion Agenda

1. **High Severity Issues** ({count})
   - {list with agent positions}

2. **Disputed Findings** ({count})
   - {list where agents disagree}

3. **Cross-Story Patterns** ({count})
   - {patterns identified by agents}

---

Agents are pre-informed. Ready for discussion.
```

### Step 3.2: Invoke BMAD Party Mode

```
Tell the user:

"🎉 **Launching BMAD Party Mode**

The following agents have completed their pre-analysis and are ready to discuss:
- {list agents with their key insights}

I'm now invoking BMAD party mode with this context pre-loaded.
Each agent will enter the discussion already informed about the findings.

---

*party-mode

{Paste the prepared context document}

Let's start with the high severity issues. {Agent with strongest opinion}, what's your view on {first high severity issue}?"
```

### Step 3.3: Facilitate Discussion

During party mode:
- Let agents discuss each finding
- Capture user decisions (Accept/Defer/Reject)
- Note action items and assignments
- Track which findings have been addressed

### Step 3.4: Conclude and Capture Decisions

When discussion ends:

```
📋 **Discussion Summary**

**Decisions Made**:
- ✅ Accepted: {count} findings
- ⏸️ Deferred: {count} findings (to {target stories})
- ❌ Rejected: {count} findings

**Action Items**:
- {list action items with assignments}

**Stories to Update**:
- Story {2.1}: Add {count} acceptance criteria
- Story {2.3}: Modify {count} criteria

Would you like me to update the story files now? [Y/N]
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
- **Phase 3 uses real BMAD party mode** - Familiar interactive experience
- **Skip to quick review** for simple stories with few findings
- **Use --thorough** for security-critical or complex stories
