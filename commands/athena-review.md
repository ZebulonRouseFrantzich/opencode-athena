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

While Oracle reviews are running or after they complete, run automated checks:

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

## Step 7: Update Story Status

Based on the Quality Gate Decision:

### If PASS (no critical issues, no blockers, LSP clean, build/tests pass):

```
athena_update_status({
  storyId: "{storyId}",
  status: "completed",
  completionSummary: "Quality gate PASSED. Oracle code review: {X} issues (all addressed). Adversarial review: {Y} findings (all resolved). All automated checks passed. All acceptance criteria verified."
})
```

### If FAIL (critical issues OR blockers OR LSP errors OR build/test failures):

```
athena_update_status({
  storyId: "{storyId}",
  status: "in_progress",
  notes: "Quality gate FAILED. Must fix: {count} critical issues, {count} blockers, {count} LSP errors. See quality gate report above. Re-run /athena-review after fixes."
})
```

### If NEEDS WORK (warnings/gaps but no critical issues):

```
athena_update_status({
  storyId: "{storyId}",
  status: "needs_review",
  notes: "Quality gate: NEEDS WORK. Critical issues resolved, but {count} warnings and {count} gaps found. Recommend addressing before completion. See quality gate report above."
})
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
