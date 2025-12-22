---
description: Run a combined quality gate on the current story implementation
---

# Athena Review - Automated Quality Gate

Perform a comprehensive quality review by orchestrating **oh-my-opencode Oracle code review** and **BMAD adversarial review**, both powered by Oracle's deep reasoning capabilities.

**You are Sisyphus, the orchestrator.** You will coordinate multiple review perspectives and synthesize the findings.

## Step 1: Load Story Context

Call **athena_get_story** to get the current story context:

```
athena_get_story()
```

This returns:
- Story requirements and acceptance criteria
- Relevant architecture sections
- Relevant PRD sections
- Sprint context

**CRITICAL: Check for Previous Review Decisions**

After loading the story, check if the story file contains an **Implementation Notes** section from a previous review. This section will be present if `/athena-review` was run before and findings were discussed.

If **Implementation Notes exist**:
- Extract the **Deferred to Future Work** items
- Extract the **Not Implemented** items
- These represent USER DECISIONS from previous reviews
- You MUST NOT re-raise these issues in the current review
- Only flag NEW issues or issues the user agreed to fix

If **No Implementation Notes exist**:
- This is the first review - proceed normally with all findings

## Step 2: Identify Changed Files

Use git to identify what files were modified for this story:

```bash
git diff --name-only HEAD~1..HEAD
```

Or use `lsp_workspace_symbols` and codebase knowledge to identify the implementation files.

## Step 3: Oracle Code Review (oh-my-opencode Style)

**You MUST invoke Oracle for deep code review.**

Ask **@oracle** to perform an oh-my-opencode style code review:

```
@oracle Please perform a comprehensive code review for Story {storyId}.

**Story Context:**
{paste story requirements and acceptance criteria}

**Architecture Patterns:**
{paste relevant architecture sections}

**Changed Files:**
{list of changed files from Step 2}

**Review Focus:**

1. **Architectural Compliance**
   - Does this implementation follow the patterns defined in architecture.md?
   - Are there any architectural violations or deviations?
   - Is the code organized according to project structure conventions?

2. **Code Quality**
   - Are there code smells or anti-patterns?
   - Is complexity appropriate (no overly complex functions)?
   - Is the code self-documenting with minimal comments?
   - Are variable/function names clear and consistent?

3. **Type Safety** (if TypeScript/typed language)
   - Are types used properly?
   - Any use of `any`, `@ts-ignore`, `@ts-expect-error`?
   - Are return types explicit for public APIs?

4. **Error Handling**
   - Is error handling comprehensive?
   - Are edge cases covered?
   - Are errors propagated appropriately?

5. **Security**
   - Any security vulnerabilities?
   - Input validation present?
   - No hardcoded secrets or credentials?

6. **Performance**
   - Any obvious performance issues?
   - Appropriate use of async/await?
   - No unnecessary re-renders or re-computations?

7. **Test Coverage**
   - Are tests present for new functionality?
   - Do tests cover edge cases?
   - Are tests readable and maintainable?

**Output Format:**
Provide a structured review with:
- **Critical Issues** (MUST fix before completion)
- **Warnings** (SHOULD fix, affects quality)
- **Recommendations** (COULD improve, nice to have)
- **Positive Observations** (what was done well)

For each issue, include:
- File path and line number (if applicable)
- Description of the issue
- Why it's problematic
- Suggested fix
```

**Wait for Oracle's response before proceeding to Step 4.**

## Step 4: Oracle Adversarial Review (BMAD Methodology)

**You MUST invoke Oracle again for adversarial review.**

This is BMAD's quality methodology: **assume the code is broken and try to find how**.

Ask **@oracle** to perform a BMAD-style adversarial review:

```
@oracle Now perform an ADVERSARIAL review for Story {storyId}.

**Your Role:** You are a skeptical QA engineer trying to BREAK this implementation and FIND problems.

**Story Acceptance Criteria:**
{paste acceptance criteria from story}

**Implementation:**
{reference to changed files}

**Adversarial Review Instructions:**

1. **Challenge Acceptance Criteria**
   - For EACH acceptance criterion, try to find a scenario where it FAILS
   - Are there edge cases not covered by the criteria?
   - Are the criteria vague or incomplete?
   - Does the implementation actually satisfy each criterion?

2. **Edge Case Hunting**
   - What inputs could break this code?
   - What states could cause unexpected behavior?
   - What happens with:
     * Empty inputs, null, undefined
     * Very large inputs
     * Malformed or invalid inputs
     * Concurrent operations (if applicable)
     * Network failures (if applicable)

3. **Integration Vulnerabilities**
   - How could this break other parts of the system?
   - What assumptions does this code make about its dependencies?
   - What happens if those assumptions are violated?

4. **Missing Requirements**
   - What scenarios does this story NOT address but should?
   - Are there user workflows that would break?
   - What features are incomplete?

5. **Test Adequacy**
   - Can you think of tests that SHOULD exist but DON'T?
   - Do existing tests actually prove the code works?
   - Are tests checking the right things?

6. **Production Readiness**
   - What could go wrong in production that won't in development?
   - Are there monitoring/logging gaps?
   - What failure modes exist?

**Output Format:**
Provide findings as:
- **Blockers** (Critical issues that would cause failures in production)
- **Gaps** (Missing functionality or incomplete implementation)
- **Edge Cases** (Scenarios not handled correctly)
- **Test Gaps** (Missing or inadequate tests)
- **Future Risks** (Technical debt or maintainability concerns)

For each finding:
- Specific scenario that would fail
- Why it's a problem
- Severity (Critical / High / Medium / Low)
- Recommended fix or mitigation
```

**Wait for Oracle's adversarial review before proceeding to Step 5.**

## Step 5: Automated Quality Checks

After receiving both Oracle reviews (Steps 3 and 4), run automated checks:

### 5.1 LSP Diagnostics

For each changed file, run:

```
lsp_diagnostics(filePath: "<file>", severity: "all")
```

Collect all errors and warnings.

### 5.2 Anti-Pattern Detection

Use AST-grep to check for common anti-patterns:

**For TypeScript/JavaScript projects:**

```
ast_grep_search(pattern: "console.log($$$)", lang: "typescript")
ast_grep_search(pattern: "as any", lang: "typescript")
ast_grep_search(pattern: "catch($E) {}", lang: "typescript")
ast_grep_search(pattern: "@ts-ignore", lang: "typescript")
ast_grep_search(pattern: "@ts-expect-error", lang: "typescript")
```

**For Python projects:**

```
ast_grep_search(pattern: "except: pass", lang: "python")
ast_grep_search(pattern: "print($$$)", lang: "python")
```

### 5.3 Build Verification

If the project has a build script in `package.json` or equivalent:

```bash
npm run build
# OR
pnpm run build
# OR
yarn build
```

Capture build output and check for errors.

### 5.4 Test Execution

If the project has tests:

```bash
npm test
# OR
pnpm test
# OR
yarn test
```

Capture test results.

## Step 6: Synthesize Quality Gate Report

**After receiving both Oracle reviews and automated check results**, synthesize a unified quality gate report.

**CRITICAL: Filter Against Previous Decisions**

Before generating the report, if Implementation Notes exist from Step 1:

1. **Load previous decisions** from the story file's Implementation Notes section
2. **Extract deferred/not-implemented items** (exact descriptions or keywords)
3. **Filter Oracle findings**:
   - EXCLUDE any finding that matches items marked as "Deferred to Future Work"
   - EXCLUDE any finding that matches items marked as "Not Implemented"
   - INCLUDE only NEW findings or items the user agreed to fix
4. **Note filtered items**: If you filter out findings, mention this in the report: "X findings excluded (previously deferred/rejected in prior review)"

This ensures you don't re-block the story on issues the user has already made decisions about.

Generate this structured report:

```markdown
# Quality Gate Report: Story {storyId}

## Summary

- **Overall Status**: PASS / FAIL / NEEDS WORK
- **Review Date**: {current date}
- **Reviewed By**: Sisyphus (orchestrator) + Oracle (reviews)

---

## Oracle Code Review (oh-my-opencode)

### Critical Issues: {count}
{list all critical issues from Oracle's code review}

### Warnings: {count}
{list all warnings from Oracle's code review}

### Recommendations: {count}
{list all recommendations from Oracle's code review}

### Positive Observations:
{list what Oracle noted as well-done}

---

## Oracle Adversarial Review (BMAD Methodology)

### Blockers: {count}
{list all blockers from Oracle's adversarial review}

### Gaps: {count}
{list all gaps from Oracle's adversarial review}

### Edge Cases: {count}
{list all unhandled edge cases from Oracle's adversarial review}

### Test Gaps: {count}
{list all test gaps from Oracle's adversarial review}

### Future Risks: {count}
{list all future risks from Oracle's adversarial review}

---

## Automated Quality Checks

### LSP Diagnostics
- **Errors**: {count} {list if any}
- **Warnings**: {count} {list if any}

### Anti-Patterns Detected
{list any anti-patterns found via ast_grep}

### Build Status
- **Result**: PASS / FAIL
- **Output**: {relevant build output if failed}

### Test Results
- **Result**: PASS / FAIL
- **Tests Run**: {count}
- **Tests Passed**: {count}
- **Tests Failed**: {count} {list failures if any}

---

## Acceptance Criteria Verification

{For each acceptance criterion from the story:}

### AC{number}: {criterion text}
- **Status**: ✅ VERIFIED / ⚠️ PARTIAL / ❌ NOT MET
- **Evidence**: {how it's verified or what's missing}
- **Issues**: {any issues from reviews related to this criterion}

---

## Quality Gate Decision

### Gate Status: PASS / FAIL / NEEDS WORK

**Decision Rationale:**
{Explain why the gate passed, failed, or needs work based on:
- Number and severity of critical issues
- Blocker count
- LSP errors (must be 0 for PASS)
- Build failures (must pass for PASS)
- Test failures (must pass for PASS)
- Acceptance criteria verification
}

### Must Fix Before Completion:
{List all critical issues, blockers, and LSP errors that MUST be fixed}

### Should Fix (Recommended):
{List warnings, gaps, and edge cases that SHOULD be addressed}

### Optional Improvements:
{List recommendations and future risks for consideration}

---

## Next Steps

{if PASS}:
1. All quality checks passed
2. Ready to mark story as completed
3. No blocking issues found

{if FAIL}:
1. CRITICAL: Address all must-fix items above
2. Re-run quality gate after fixes
3. Do NOT mark story complete until gate passes

{if NEEDS WORK}:
1. Address must-fix items (critical issues, blockers, LSP errors)
2. Consider addressing should-fix items for better quality
3. Re-run quality gate after critical fixes
```

## Step 7: Discuss Findings and Update Story

Based on the Quality Gate Decision, take different actions:

### If PASS (no critical issues, no blockers, LSP clean, build/tests pass):

Auto-update status to completed:

```
athena_update_status({
  storyId: "{storyId}",
  status: "completed",
  completionSummary: "Quality gate PASSED. Oracle code review: {X} issues (all addressed). Adversarial review: {Y} findings (all resolved). All automated checks passed. All acceptance criteria verified."
})
```

Congratulate the user and move on.

### If FAIL or NEEDS WORK (issues found after filtering):

Follow this collaborative process:

**Step 7a: Update Status to In Progress**

First, immediately update the story status:

```
athena_update_status({
  storyId: "{storyId}",
  status: "in_progress",
  notes: "Quality gate completed. Found {count} critical issues, {count} blockers, {count} warnings, {count} gaps. Awaiting user input on which findings to address."
})
```

**Step 7b: Discuss Findings with User**

Present the findings collaboratively (remember: already filtered against previous decisions):

```
I've completed the quality gate review for Story {storyId}. Here's what I found:

**Critical Issues**: {count}
{list each with file/line if available}

**Blockers**: {count}
{list each with scenario that would fail}

**Warnings & Gaps**: {count}
{list each with severity}

**Automated Checks**:
- LSP Errors: {count}
- Build: {PASS/FAIL}
- Tests: {PASS/FAIL}

{if previous review existed}
Note: {X} findings from Oracle were excluded because you previously decided to defer or not implement them.
{endif}

**My Assessment**:

**Must Fix** (blocks story completion):
- {item 1}
- {item 2}
...

**Should Fix** (significantly improves quality):
- {item 1}
- {item 2}
...

**Optional** (nice-to-have):
- {item 1}
- {item 2}
...

Let's discuss:
1. Which findings do you want to address in this story?
2. Are there any findings you want to defer to future work?
3. Are there any findings you disagree with or want to mark as "Not Implemented"?

Once we agree on scope, I'll update the story file with implementation notes.
```

**Wait for user response before proceeding to Step 7c.**

**Step 7c: Update Story File with Implementation Notes**

After the user has decided which findings to address, update the story file.

If this is the **first review** (no Implementation Notes section exists):

Append this section to the story file at `docs/stories/story-{epic}-{number}.md`:

```markdown
## Implementation Notes

### Quality Review - {current date and time}

**Findings to Address:**
- [ ] {Finding description} - Priority: Critical - File: {file}:{line}
- [ ] {Finding description} - Priority: High - File: {file}:{line}
- [ ] {Finding description} - Priority: Medium

**Deferred to Future Work:**
- {Finding description} - Reason: {user's reason} - Target: {Epic X, Story Y if mentioned}

**Not Implemented:**
- {Finding description} - Reason: {user's reason - e.g., "Out of scope", "Disagree with finding", "Accepted risk"}

**Review Conducted By**: Sisyphus + Oracle (Code Review + Adversarial Review)  
**Automated Checks**: LSP: {result}, Build: {result}, Tests: {result}
```

If this is a **subsequent review** (Implementation Notes section already exists):

**Preserve the previous review notes** and append a new section:

```markdown
### Quality Review - {current date and time} (Follow-up Review)

**Previous Review Status:**
- {X} items were addressed from previous review
- {Y} items remain in progress
- {Z} items remain deferred

**New Findings to Address:**
- [ ] {New finding} - Priority: {level}

**Additional Deferred Items:**
- {Finding description} - Reason: {user's reason}

**Additional Not Implemented Items:**
- {Finding description} - Reason: {user's reason}

**Review Conducted By**: Sisyphus + Oracle  
**Automated Checks**: LSP: {result}, Build: {result}, Tests: {result}
```

Use the Read tool to load the story file, then use the Edit tool to append these notes.

**Step 7d: Recommend Approach (Stay in Session vs Restart)**

After updating the story file, analyze the situation and recommend an approach to the user:

Evaluate:
1. **Fix Complexity**: Are the fixes simple (type errors, minor logic) or complex (architectural changes)?
2. **Fix Scope**: How many files need changes? How many lines?
3. **Session Health**: Is the current session reasonably sized or bloated with context?
4. **Fix Type**: Bug fixes vs refactoring vs new features?

Then provide a recommendation:

```
I've updated the story file with our agreed implementation notes.

**My Recommendation**: {Stay in Current Session / Start Fresh Session}

{if recommending STAY IN SESSION}:
**Reasoning**:
- The fixes are straightforward: {brief explanation}
- Estimated changes: {X files, Y lines, simple/moderate complexity}
- Current session context is valuable and not too bloated
- Estimated fix time: {rough estimate based on complexity}
- Benefits: Maintain context, efficient iteration

**Shall I proceed with the fixes in this session?**

{if recommending START FRESH SESSION}:
**Reasoning**:
- The fixes require: {architectural changes / major refactoring / cross-cutting concerns}
- Estimated changes: {X files, Y lines, high complexity}
- Current session is {too long / context-heavy / would benefit from fresh start}
- Benefits: Clean context, better planning, clearer focus

**I recommend:**
1. Exit this session
2. Run `/athena-dev` to reload the story (it will pick up the implementation notes)
3. Implement the fixes with a clear strategy
4. Run `/athena-review` again when complete

**What would you like to do?**

{always provide options}:
1. **Continue in this session** - I'll start fixing the items now
2. **Exit and restart `/athena-dev`** - Fresh session approach
3. **Something else** - Discuss further or modify the plan
```

**Wait for user decision before proceeding.**

## Step 8: Execute Based on User Decision

After presenting your recommendation in Step 7d, the user will choose one of the following paths:

### Path A: User Chooses to Continue in Current Session

If the user wants to proceed with fixes in the current session:

```
Great, I'll proceed with the fixes in this session.

I'll work through the implementation notes systematically:
{list the checkboxed items from the story file}

As I complete each fix, I'll check it off in the story file.

When all fixes are complete, I'll run `/athena-review` again to verify the quality gate passes.
```

Then:
1. Work through each item in the "Findings to Address" list
2. Use the Read tool to check off completed items (convert `- [ ]` to `- [x]`)
3. Run `lsp_diagnostics` on changed files
4. When all items are checked off, inform the user and recommend running `/athena-review` again

### Path B: User Chooses to Exit and Restart

If the user wants to start a fresh session:

```
Understood. The story file has been updated with implementation notes at:
`docs/stories/story-{epic}-{number}.md`

The implementation notes detail exactly what needs to be fixed based on our discussion.

When you run `/athena-dev` again:
- Sisyphus will automatically load these implementation notes
- The notes will guide the fix implementation
- After fixes are complete, run `/athena-review` again

The sprint status remains at 'in_progress' until the quality gate passes.

Good luck with the fixes!
```

Then end the session.

### Path C: User Wants to Defer All Fixes or Make Other Changes

If the user wants to modify the plan or defer all work:

```
I understand you want to {take a different approach}.

Options:
1. **Modify the implementation notes** - We can adjust what's in "Findings to Address" vs "Deferred"
2. **Mark story as blocked** - If waiting on external dependencies
3. **Keep as in_progress** - Come back to this later
4. **Mark complete despite findings** - (Not recommended, but your choice)

What would you like to do?
```

Then follow the user's guidance and update the story status accordingly using `athena_update_status`.

### Re-running the Review

When `/athena-review` is run again after fixes:
- Step 1 will load the implementation notes
- Step 6 will filter out previously deferred/not-implemented items
- Only NEW issues or unfixed items will be flagged
- If all agreed fixes are complete and no new issues found → PASS

This creates an iterative loop:
```
Review → Discuss → Fix → Review → Discuss → Fix → ... → PASS
```

## Important Notes

### Review Philosophy

- **Oracle Code Review**: Architectural and code quality perspective (constructive)
- **Oracle Adversarial Review**: QA/testing perspective (destructive - trying to break it)
- **Both use the same model** (Oracle agent model, typically GPT-5.2)
- **Both perspectives are essential** for comprehensive quality assurance

### Cost Awareness

- **Oracle is expensive** (high-quality reasoning model)
- **Two Oracle invocations** per quality gate
- Only use `/athena-review` for **significant story implementations**
- For trivial changes, manual checks may suffice

### Quality Standards

- **LSP errors MUST be 0** for PASS
- **Build MUST succeed** for PASS
- **Tests MUST pass** for PASS (if tests exist)
- **Critical issues MUST be 0** for PASS
- **Blockers MUST be 0** for PASS

### When to Use

Use `/athena-review`:
- ✅ Before marking a story complete
- ✅ After implementing significant features
- ✅ When quality is critical (production code)
- ✅ When multiple acceptance criteria exist

Don't use `/athena-review` for:
- ❌ Trivial changes (typo fixes, comment updates)
- ❌ Documentation-only changes
- ❌ Configuration changes
- ❌ When you've already manually verified everything
