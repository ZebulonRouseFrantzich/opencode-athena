# Migration System Guide

This document explains how to add migrations to OpenCode Athena when making config changes.

## When Do I Need a Migration?

You **MUST** add a migration if you:
- ✅ Add new fields to `athena.json` schema
- ✅ Remove fields from `athena.json` schema
- ✅ Rename fields in `athena.json` or `oh-my-opencode.json`
- ✅ Change default values that affect existing installations
- ✅ Make any breaking change to config structure

You **DO NOT** need a migration if you:
- ❌ Only add new bridge commands (`.md` files)
- ❌ Update plugin code without config changes
- ❌ Fix bugs without changing config schema
- ❌ Add new dependencies (unless they require config changes)

## Quick Migration Checklist

When adding a new config field:

- [ ] 1. Update `package.json` version (`npm version patch|minor|major`)
- [ ] 2. Add migration to `src/cli/utils/migrations/migrations.ts`
- [ ] 3. Add test to `tests/cli/migrations.test.ts`
- [ ] 4. Update generator (`src/cli/generators/athena-config.ts` or `omo-config.ts`)
- [ ] 5. Update Zod schema (`src/shared/schemas.ts`)
- [ ] 6. Run `npm run test:run` to verify

## Example: Adding a New Feature Flag

Let's say you want to add a new feature flag called `enableCoolFeature`.

### Step 1: Update Version

```bash
npm version minor  # 0.5.0 -> 0.6.0
```

### Step 2: Add Migration

Edit `src/cli/utils/migrations/migrations.ts`:

```typescript
export const MIGRATIONS: Migration[] = [
  // ... existing migrations ...
  {
    fromVersion: "0.5.0",
    toVersion: "0.6.0",
    description: "Add enableCoolFeature flag",
    migrateAthena: (config) => {
      const features = (config.features as Record<string, unknown>) || {};
      
      // Check if field already exists (idempotent)
      if (features.enableCoolFeature === undefined) {
        features.enableCoolFeature = false; // Safe default
      }
      
      return { ...config, features };
    },
  },
];
```

### Step 3: Add Test

Edit `tests/cli/migrations.test.ts`:

```typescript
describe("migrations", () => {
  // ... existing tests ...
  
  it("adds enableCoolFeature when migrating from 0.5.0 to 0.6.0", () => {
    const oldAthena = {
      version: "0.5.0",
      features: {
        existingFeature: true,
      },
    };

    const result = migrateConfigs(oldAthena, {}, "0.5.0");

    const features = result.athenaConfig.features as Record<string, unknown>;
    expect(features.enableCoolFeature).toBe(false);
    expect(features.existingFeature).toBe(true); // Preserved!
  });
});
```

### Step 4: Update Generator

Edit `src/cli/generators/athena-config.ts`:

```typescript
export function generateAthenaConfig(answers: InstallAnswers): Record<string, unknown> {
  // ... existing code ...
  
  return {
    // ... other fields ...
    features: {
      bmadBridge: true,
      autoStatus: features.enabledFeatures.includes("auto-status"),
      // ... other features ...
      enableCoolFeature: features.enabledFeatures.includes("cool-feature"), // NEW
    },
  };
}
```

### Step 5: Update Schema

Edit `src/shared/schemas.ts`:

```typescript
export const FeaturesSchema = z.object({
  bmadBridge: z.boolean(),
  autoStatus: z.boolean(),
  // ... other features ...
  enableCoolFeature: z.boolean(), // NEW
});
```

### Step 6: Verify

```bash
npm run test:run
npm run build
```

## Example: Renaming a Field

If you're renaming a field (e.g., `oldName` → `newName`):

```typescript
{
  fromVersion: "0.5.0",
  toVersion: "0.6.0",
  description: "Rename oldName to newName",
  migrateAthena: (config) => {
    const features = (config.features as Record<string, unknown>) || {};
    
    // Migrate old field to new field
    if (features.oldName !== undefined) {
      features.newName = features.oldName;
      delete features.oldName;
    }
    
    return { ...config, features };
  },
}
```

## Example: Migrating oh-my-opencode.json

If you need to update `oh-my-opencode.json`:

```typescript
{
  fromVersion: "0.5.0",
  toVersion: "0.6.0",
  description: "Update agent configuration format",
  migrateAthena: (config) => {
    // Athena config changes here
    return config;
  },
  migrateOmo: (config) => {
    const agents = (config.agents as Record<string, unknown>) || {};
    
    // Update agent structure
    if (agents.sisyphus) {
      const sisyphus = agents.sisyphus as Record<string, unknown>;
      // Migrate agent config here
    }
    
    return { ...config, agents };
  },
}
```

## Migration System Internals

### How Migrations Run

1. User runs `npx opencode-athena@latest install` or `opencode-athena upgrade`
2. System detects existing `athena.json` and reads its `version` field
3. Compares existing version to current package version
4. Applies all migrations between those versions in order
5. Updates `version` field in `athena.json`

### Migration Ordering

Migrations run in version order using semver:

```typescript
// If user has version 0.3.0 and package is 0.6.0:
// Runs: 0.3.0→0.4.0, then 0.4.0→0.5.0, then 0.5.0→0.6.0

const sortedMigrations = MIGRATIONS.sort((a, b) => 
  semver.compare(a.fromVersion, b.fromVersion)
);
```

### Breaking Changes

If `fromVersion` and `toVersion` have different major versions (e.g., `1.5.0` → `2.0.0`):
- Migration is marked as breaking
- User gets a warning prompt
- Must confirm before proceeding

Example breaking migration:

```typescript
{
  fromVersion: "1.9.0",
  toVersion: "2.0.0", // Major version bump
  description: "Remove deprecated features field",
  migrateAthena: (config) => {
    // Remove old structure
    delete config.oldStructure;
    
    // User will be warned before this runs
    return config;
  },
}
```

## Common Pitfalls

### ❌ DON'T: Assume field doesn't exist

```typescript
// BAD - Will overwrite user's existing value!
migrateAthena: (config) => {
  config.features.newField = true;
  return config;
}
```

### ✅ DO: Check before setting

```typescript
// GOOD - Preserves user's value if they already have it
migrateAthena: (config) => {
  const features = (config.features as Record<string, unknown>) || {};
  if (features.newField === undefined) {
    features.newField = true;
  }
  return { ...config, features };
}
```

### ❌ DON'T: Mutate config directly

```typescript
// BAD - Mutates original object
migrateAthena: (config) => {
  config.features.newField = true;
  return config;
}
```

### ✅ DO: Create new objects

```typescript
// GOOD - Immutable update
migrateAthena: (config) => {
  const features = { ...(config.features as Record<string, unknown>) };
  features.newField = true;
  return { ...config, features };
}
```

### ❌ DON'T: Use dangerous defaults

```typescript
// BAD - Could break existing setups
migrateAthena: (config) => {
  config.features.autoDeleteFiles = true; // DANGER!
  return config;
}
```

### ✅ DO: Use safe defaults

```typescript
// GOOD - Safe, opt-in default
migrateAthena: (config) => {
  const features = (config.features as Record<string, unknown>) || {};
  if (features.autoDeleteFiles === undefined) {
    features.autoDeleteFiles = false; // Safe default
  }
  return { ...config, features };
}
```

## Testing Migrations

Always test that:

1. **Fresh installs work**: Users without existing config get correct defaults
2. **Upgrades work**: Users with old config get migrated properly
3. **User customizations preserved**: Custom values aren't overwritten
4. **Idempotent**: Running migration twice doesn't break anything

```typescript
describe("migration 0.5.0 -> 0.6.0", () => {
  it("works on fresh install", () => {
    const freshConfig = generateAthenaConfig(mockAnswers);
    expect(freshConfig.features.newField).toBe(true);
  });

  it("migrates old config", () => {
    const oldConfig = { version: "0.5.0", features: {} };
    const result = migrateConfigs(oldConfig, {}, "0.5.0");
    expect(result.athenaConfig.features.newField).toBe(true);
  });

  it("preserves user customizations", () => {
    const oldConfig = { 
      version: "0.5.0", 
      features: { customField: "user-value" } 
    };
    const result = migrateConfigs(oldConfig, {}, "0.5.0");
    expect(result.athenaConfig.features.customField).toBe("user-value");
  });

  it("is idempotent", () => {
    const config = { version: "0.5.0", features: {} };
    const result1 = migrateConfigs(config, {}, "0.5.0");
    const result2 = migrateConfigs(result1.athenaConfig, {}, "0.6.0");
    expect(result1.athenaConfig).toEqual(result2.athenaConfig);
  });
});
```

## Debugging Migrations

If a migration fails:

1. **Check backup files**: Migrations create timestamped backups in `~/.config/opencode/`
   - `athena.json.backup-2025-12-24T12-00-00-000Z`
   - `oh-my-opencode.json.backup-2025-12-24T12-00-00-000Z`

2. **View migration logs**: Users see which migrations ran:
   ```
   Applied 2 migration(s)
     • 0.4.0 → 0.5.0: Add autoGitOperations feature flag
     • 0.5.0 → 0.6.0: Add enableCoolFeature flag
   ```

3. **Test migration in isolation**:
   ```typescript
   const testConfig = { version: "0.5.0", features: {} };
   const result = migrateConfigs(testConfig, {}, "0.5.0");
   console.log(result);
   ```

## Version Strategy

### Semantic Versioning

- **Patch** (`0.5.0` → `0.5.1`): Bug fixes, no config changes
- **Minor** (`0.5.0` → `0.6.0`): New features, backwards-compatible migrations
- **Major** (`1.0.0` → `2.0.0`): Breaking changes, user must confirm upgrade

### When to Bump

| Change | Version Bump | Migration Required |
|--------|--------------|-------------------|
| Add new optional field | Minor | Yes |
| Add new required field | Major | Yes |
| Rename field | Major | Yes |
| Remove field | Major | Yes |
| Change default value | Minor or Major* | Yes |
| Fix bug | Patch | No |
| Update deps | Patch | No |

*Major if the new default could break existing setups.

## PR Review Process

OpenCode Athena includes automated checks to catch missing migrations during code review.

### For Contributors

When opening a PR that changes config files, use the **PR template checklist**:

1. Fill out the **Migration Checklist** section
2. If you changed schemas/generators, verify all 4 items are complete
3. If no migration needed, explain why in the template

See: [`.github/pull_request_template.md`](../.github/pull_request_template.md)

### For Reviewers

**GitHub Copilot automatically checks** for missing migrations when reviewing PRs.

**What Copilot checks:**
- Schema changes in `src/shared/schemas.ts` without migration
- Generator changes without schema updates
- Version bumps without migrations
- Default value changes without migrations
- Field renames without data preservation

**Review guidelines:**
- Copilot will post **BLOCKING** comments for missing migrations
- Copilot will post **WARNING** comments for potential issues
- Manual review should verify migration tests exist and are comprehensive

See: [`.github/copilot-instructions.md`](../.github/copilot-instructions.md)

### How It Works

```
Developer changes schema → Opens PR
                    ↓
GitHub Copilot reads .github/copilot-instructions.md
                    ↓
Copilot checks: schemas.ts ⟷ migrations.ts ⟷ package.json
                    ↓
        Missing migration detected?
                    ↓
    YES: Post blocking comment with checklist
    NO: Approve or check for other issues
```

**Files monitored:**
- `src/shared/schemas.ts` - Zod schema definitions
- `src/cli/generators/athena-config.ts` - Athena config generator
- `src/cli/generators/omo-config.ts` - oh-my-opencode config generator
- `src/cli/utils/migrations/migrations.ts` - Migration registry
- `package.json` - Version tracking

### Bypassing Migration Checks

If you have a legitimate reason to skip a migration (e.g., internal refactoring only):

1. Add clear justification in PR description
2. Respond to Copilot's blocking comment explaining why
3. Request manual reviewer override

**Never bypass for actual config changes** - this will break user upgrades.

## Summary

**Key Takeaways:**
1. **Always add migrations** when changing config schema
2. **Always test migrations** with old configs
3. **Always use safe defaults** that won't break existing setups
4. **Always preserve user customizations**
5. **Always make migrations idempotent**

**Quick command:**
```bash
npm version minor && \
  echo "Now add migration to src/cli/utils/migrations/migrations.ts" && \
  echo "Then add test to tests/cli/migrations.test.ts"
```
