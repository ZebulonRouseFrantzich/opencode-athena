# Story File Example with Implementation Notes

This example shows what a BMAD story file looks like after quality review with implementation notes.

## Example: Story 2.3 - User Authentication

### Story Overview

**Epic**: Authentication System  
**Story ID**: 2.3  
**Title**: Implement JWT-based user authentication

### Acceptance Criteria

- [ ] AC1: Users can register with email and password
- [ ] AC2: Users can log in and receive a JWT token
- [ ] AC3: Protected routes verify JWT tokens
- [ ] AC4: Tokens expire after 24 hours
- [ ] AC5: Password hashing uses bcrypt with salt

### Technical Notes

- Use jsonwebtoken library for JWT creation/verification
- Store tokens in HTTP-only cookies
- Implement refresh token mechanism

---

## Implementation Notes

### Quality Review - 2025-12-22 14:30:00

**Findings to Address:**
- [ ] Critical: JWT secret is hardcoded in auth.ts - move to environment variable - Priority: Critical - File: src/auth/auth.ts:42
- [ ] High: Password validation missing strength requirements (min 8 chars, special chars) - Priority: High - File: src/auth/validation.ts:15
- [ ] High: Missing rate limiting on login endpoint (vulnerable to brute force) - Priority: High - File: src/routes/auth.ts:28
- [ ] Medium: Error messages leak information about user existence - Priority: Medium - File: src/auth/login.ts:55

**Deferred to Future Work:**
- Implement OAuth2 providers (Google, GitHub) - Reason: Out of scope for this story, complex integration - Target: Epic 3, Story 3.2
- Add two-factor authentication (2FA) - Reason: Nice-to-have, defer to next sprint - Target: Epic 2, Story 2.5

**Not Implemented:**
- Use Redis for token blacklisting - Reason: Adds infrastructure complexity, accepted risk for MVP - User decision: Keep simple with in-memory cache for now
- Implement passwordless magic link authentication - Reason: Disagree with finding, not a common user request

**Review Conducted By**: Sisyphus + Oracle (Code Review + Adversarial Review)  
**Automated Checks**: LSP: 2 errors, Build: PASS, Tests: 12/14 passed (2 failing)

---

### Quality Review - 2025-12-22 16:45:00 (Follow-up Review)

**Previous Review Status:**
- ✅ 3 items addressed from previous review (JWT secret, password validation, rate limiting)
- ⚠️ 1 item partially complete (error messages - still need refinement)
- 📋 2 items remain deferred (OAuth2, 2FA)

**New Findings to Address:**
- [ ] Medium: Rate limiting implementation uses global counter instead of per-IP - Priority: Medium - File: src/middleware/rate-limit.ts:12
- [ ] Low: Missing JSDoc comments on public authentication functions - Priority: Low

**Completed from Previous Review:**
- [x] Critical: JWT secret is hardcoded in auth.ts - moved to environment variable
- [x] High: Password validation missing strength requirements - now requires min 8 chars, 1 special char, 1 number
- [x] High: Missing rate limiting on login endpoint - implemented with express-rate-limit middleware

**Still In Progress:**
- [ ] Medium: Error messages leak information about user existence - Partially fixed, needs final review

**Additional Deferred Items:**
- Add CAPTCHA on repeated login failures - Reason: Can implement in next iteration if needed

**Additional Not Implemented Items:**
- None this review

**Review Conducted By**: Sisyphus + Oracle  
**Automated Checks**: LSP: 0 errors ✅, Build: PASS ✅, Tests: 14/14 passed ✅

---

## Notes on Implementation Notes Format

### Structure for First Review:

```markdown
## Implementation Notes

### Quality Review - {timestamp}

**Findings to Address:**
- [ ] {Description} - Priority: {Critical/High/Medium/Low} - File: {path}:{line}

**Deferred to Future Work:**
- {Description} - Reason: {why} - Target: {where/when}

**Not Implemented:**
- {Description} - Reason: {why}

**Review Conducted By**: Sisyphus + Oracle (Code Review + Adversarial Review)  
**Automated Checks**: LSP: {result}, Build: {result}, Tests: {result}
```

### Structure for Follow-up Reviews:

```markdown
### Quality Review - {timestamp} (Follow-up Review)

**Previous Review Status:**
- ✅ {count} items addressed
- ⚠️ {count} items in progress
- 📋 {count} items remain deferred

**New Findings to Address:**
- [ ] {New finding}

**Completed from Previous Review:**
- [x] {Completed item}

**Still In Progress:**
- [ ] {Incomplete item}

**Additional Deferred Items:**
- {New deferred item}

**Review Conducted By**: Sisyphus + Oracle  
**Automated Checks**: LSP: {result}, Build: {result}, Tests: {result}
```

### Key Features:

1. **Checkboxes** - Easy progress tracking with `- [ ]` and `- [x]`
2. **Priorities** - Critical/High/Medium/Low for triaging
3. **File References** - Direct links to code locations
4. **Decision History** - Clear record of what was deferred/rejected and why
5. **Review Continuity** - Follow-up reviews reference previous decisions
6. **Automated Checks** - Verification that quality gates were run

### Benefits:

- **Transparency**: All decisions documented in story file
- **Continuity**: Subsequent reviews don't re-block on deferred items
- **Accountability**: Clear record of what was agreed vs what was implemented
- **Traceability**: Easy to see why certain findings weren't addressed
- **Progress Tracking**: Checkboxes show work completion status
