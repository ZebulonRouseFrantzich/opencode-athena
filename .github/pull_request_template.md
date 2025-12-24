## Description

<!-- Briefly describe what this PR does -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Configuration change

## Migration Checklist

**⚠️ REQUIRED if you modified any of these files:**
- `src/shared/schemas.ts`
- `src/cli/generators/athena-config.ts`
- `src/cli/generators/omo-config.ts`

**If you changed config schemas or generators, have you:**
- [ ] Bumped version in `package.json` (patch/minor/major as appropriate)
- [ ] Added migration in `src/cli/utils/migrations/migrations.ts`
- [ ] Added test in `tests/cli/migrations.test.ts`
- [ ] Updated generator to include new fields
- [ ] N/A - No config changes in this PR

**If N/A, explain why no migration is needed:**
<!-- e.g., "Internal refactoring only, no config schema changes" -->

📖 See: [MIGRATIONS.md](/MIGRATIONS.md) for detailed guide

## Testing

- [ ] All existing tests pass (`npm run test:run`)
- [ ] Added new tests for new functionality
- [ ] Manually tested the changes
- [ ] Tested upgrade path (if config changes)

**Test command used:**
```bash
npm run test:run
```

## Documentation

- [ ] Updated README.md (if user-facing changes)
- [ ] Updated AGENTS.md (if affecting AI agent behavior)
- [ ] Updated MIGRATIONS.md (if new migration patterns)
- [ ] Added/updated code comments where needed

## Additional Context

<!-- Add any other context, screenshots, or information about the PR here -->

---

## Reviewer Notes

<!-- For reviewers: Check that config changes include migrations -->
- GitHub Copilot will automatically check for missing migrations
- See `.github/copilot-instructions.md` for review guidelines
