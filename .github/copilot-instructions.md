# GitHub Copilot Code Review Instructions

## Primary Mission: Catch Missing Migrations

**CRITICAL**: OpenCode Athena has a migration system that MUST be updated whenever config schemas change. Missing migrations = broken user upgrades.

---

## 🚨 BLOCKING Issues (Request Changes)

### 1. Config Schema Changes Without Migration

**Watch these files:**
- `src/shared/schemas.ts` - Zod schema definitions
- `src/cli/generators/athena-config.ts` - Athena config generator
- `src/cli/generators/omo-config.ts` - oh-my-opencode config generator

**If ANY of these files are modified, verify:**

✅ **REQUIRED CHECKS:**
1. Is `package.json` version bumped?
   - New field added → patch version (0.5.0 → 0.5.1)
   - Field renamed/removed → minor version (0.5.0 → 0.6.0)
   - Breaking change → major version (0.5.0 → 1.0.0)

2. Is there a corresponding migration in `src/cli/utils/migrations/migrations.ts`?
   - Migration must have matching `toVersion` = new package.json version
   - Migration must handle the schema change

3. Is there a test in `tests/cli/migrations.test.ts`?
   - Test must verify the migration works correctly
   - Test must verify existing user configs are preserved

**Example violations to catch:**

```typescript
// ❌ BAD: Added field to schema, but no migration
// File: src/shared/schemas.ts
export const athenaConfigSchema = z.object({
  version: z.string(),
  features: z.object({
    enableAwesomeFeature: z.boolean().default(true), // NEW FIELD
  }),
});

// Missing:
// - Version bump in package.json
// - Migration in migrations.ts
// - Test in migrations.test.ts
```

```typescript
// ✅ GOOD: All three files updated
// 1. src/shared/schemas.ts - added field
// 2. package.json - version bumped to 0.6.0
// 3. src/cli/utils/migrations/migrations.ts - migration added:
{
  fromVersion: "0.5.0",
  toVersion: "0.6.0",
  description: "Add enableAwesomeFeature flag",
  migrateAthena: (config) => {
    const features = (config.features as Record<string, unknown>) || {};
    if (features.enableAwesomeFeature === undefined) {
      features.enableAwesomeFeature = true;
    }
    return { ...config, features };
  },
}
// 4. tests/cli/migrations.test.ts - test added
```

### 2. Version Bump Without Migration

**If `package.json` version is bumped, verify:**
- Is there a new entry in `src/cli/utils/migrations/migrations.ts` with matching `toVersion`?
- If not, is there a justification? (e.g., "version bump for internal refactoring only")

**Comment template if missing:**
```markdown
🚨 **BLOCKING: Missing Migration**

`package.json` was bumped to `X.Y.Z`, but there's no corresponding migration in `src/cli/utils/migrations/migrations.ts`.

**If this version bump includes config changes:**
1. Add migration to `migrations.ts` with `toVersion: "X.Y.Z"`
2. Add test to `tests/cli/migrations.test.ts`

**If this is internal-only (no config changes):**
Add a comment in the PR description explaining why no migration is needed.

📖 See: [MIGRATIONS.md](../MIGRATIONS.md)
```

### 3. Default Value Changes Without Migration

**Watch for changes like:**
```typescript
// ❌ BAD: Changed default without migration
- enableFeatureX: z.boolean().default(false),
+ enableFeatureX: z.boolean().default(true),
```

**These require migrations** to ensure existing users get the new default (they may have no value set).

### 4. Field Renames Without Migration

**Watch for:**
```typescript
// ❌ BAD: Renamed field without migration
- oldFieldName: z.string(),
+ newFieldName: z.string(),
```

**Must have migration** that copies `oldFieldName` → `newFieldName` and preserves user data.

---

## ⚠️ WARNING Issues (Comment, Don't Block)

### 1. Generator Changes Without Schema Update

**If `athena-config.ts` or `omo-config.ts` changes but `schemas.ts` doesn't:**

```markdown
⚠️ **Potential Issue: Generator/Schema Mismatch**

Generator was modified, but schema wasn't updated. Is this intentional?

- If adding new field → update `schemas.ts` + add migration
- If fixing formatting → okay, but clarify in PR description
```

### 2. Migration Without Test

**If `migrations.ts` has a new migration but no corresponding test:**

```markdown
⚠️ **Missing Test Coverage**

New migration added, but no test found in `tests/cli/migrations.test.ts`.

Please add a test that verifies:
1. Migration transforms old config correctly
2. Existing user customizations are preserved
```

### 3. Breaking Changes Without Major Version Bump

**If migration has `migrateAthena` or `migrateOmo` that removes/renames fields:**

```markdown
⚠️ **Potential Breaking Change**

This migration modifies/removes existing fields, but `package.json` is not a major version bump.

- Field removal/rename = MAJOR version (1.0.0 → 2.0.0)
- New field with safe default = MINOR version (0.5.0 → 0.6.0)
```

---

## ✅ GOOD Patterns to Approve

### Complete Migration PR

```
✓ src/shared/schemas.ts - field added
✓ package.json - version bumped
✓ src/cli/utils/migrations/migrations.ts - migration added
✓ tests/cli/migrations.test.ts - test added
✓ src/cli/generators/athena-config.ts - generator updated
```

### Safe Migration Code

```typescript
// ✅ Checks before setting (idempotent)
if (config.newField === undefined) {
  config.newField = "default";
}

// ✅ Preserves existing values
const features = config.features || {};

// ✅ Safe default
return { ...config, newField: "safe-default" };
```

### Comprehensive Test

```typescript
it("migrates from 0.5.0 to 0.6.0 correctly", () => {
  const oldConfig = {
    version: "0.5.0",
    existingField: "user-value",
  };

  const result = migrateConfigs(oldConfig, {}, "0.5.0");

  // New field added
  expect(result.athenaConfig.newField).toBe("default");
  // Existing field preserved
  expect(result.athenaConfig.existingField).toBe("user-value");
});
```

---

## 📋 Review Checklist

When reviewing PRs that touch config-related files, verify:

- [ ] Schema changes have corresponding migrations
- [ ] Version bumps have matching migrations (or justification)
- [ ] Migrations have tests
- [ ] Migrations check `if (field === undefined)` before setting
- [ ] Breaking changes use major version bump
- [ ] Default value changes are migrated
- [ ] Field renames have migrations that preserve data
- [ ] Generator changes match schema definitions

---

## 🔗 Reference Documentation

For detailed migration guidelines, see:
- [MIGRATIONS.md](../MIGRATIONS.md) - Complete migration guide
- [AGENTS.md](../AGENTS.md#adding-a-migration) - Quick reference for AI agents

---

## 🎯 Summary: What to Look For

| File Changed | Must Check |
|--------------|------------|
| `src/shared/schemas.ts` | Migration exists + version bump + test |
| `src/cli/generators/*.ts` | Schema updated + migration exists |
| `package.json` (version) | Migration exists OR explanation why not |
| `src/cli/utils/migrations/migrations.ts` | Test exists + safe defaults |

**When in doubt, ask:** "If a user upgrades from the previous version, will their config work correctly?"
