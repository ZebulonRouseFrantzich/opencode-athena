# Agent Guidelines for OpenCode Athena

This document provides context and guidelines for AI agents working on this codebase.

## Project Overview

OpenCode Athena is a meta-plugin for OpenCode that unifies:
- **oh-my-opencode** - Execution capabilities (Sisyphus, Oracle, Librarian subagents)
- **BMAD METHOD v6** - Planning methodology (PRD, Architecture, Stories)

The goal is to bridge strategic planning with practical code execution through automated tooling.

## Architecture Summary

```
src/
├── cli/                    # CLI installer (npx opencode-athena install)
│   ├── commands/           # install, update, doctor, uninstall, info
│   ├── questions/          # Interactive prompts for setup
│   ├── generators/         # Config file generators
│   └── utils/              # File management, validation, logging
│
├── plugin/                 # OpenCode plugin runtime
│   ├── tools/              # Custom tools (athena_get_story, etc.)
│   ├── hooks/              # Event handlers (session, tool, compaction)
│   ├── tracker/            # Story and session state tracking
│   └── utils/              # YAML handling, BMAD finder, notifications
│
└── shared/                 # Shared code between CLI and plugin
    ├── types.ts            # TypeScript type definitions
    ├── constants.ts        # Version, paths, defaults
    └── schemas.ts          # Zod validation schemas
```

## Technology Stack

- **Language**: TypeScript (ES2022, ESM modules)
- **Build**: tsup
- **Testing**: Vitest
- **CLI**: Commander.js + @inquirer/prompts
- **Config**: YAML (yaml package) + JSON
- **Validation**: Zod

## Coding Standards

### TypeScript
- Strict mode enabled
- Prefer explicit types over inference for public APIs
- Use `type` for object shapes, `interface` for extensible contracts
- Async/await over raw Promises

### File Organization
- One primary export per file
- Co-locate related utilities with their primary consumer
- Shared code goes in `src/shared/`

### Error Handling
- Return error objects from tools rather than throwing
- Include actionable `suggestion` fields in error responses
- Log errors with context using the logger utility

### Plugin Tools
- Every tool must have a comprehensive `description`
- Use Zod schemas via `tool.schema` for argument validation
- Return structured objects, not raw strings

### Testing
- Unit tests in `tests/` mirroring `src/` structure
- Integration tests in `tests/integration/`
- Mock file system operations in unit tests

## Key Patterns

### BMAD Integration
- BMAD artifacts live in `docs/` within user projects (BMAD METHOD v6 default)
- `sprint-status.yaml` is the source of truth for story state
- Story files follow naming: `story-{epic}-{number}.md` (e.g., `story-2-3.md`)

### Configuration Hierarchy
1. Global: `~/.config/opencode/athena.json`
2. Project: `[project]/.opencode/athena.json` (overrides global)

### Plugin Context
The plugin receives a `PluginContext` with:
- `directory` - Project working directory
- `client` - OpenCode client for spawning agents
- `$` - Shell command executor
- `project` - Project metadata

## Implementation Notes

### CLI Installer
- Must check prerequisites (OpenCode version, Node.js version)
- Merges with existing config rather than overwriting
- Installs npm dependencies in OpenCode config directory

### Story Tracker
- Persists state to `~/.config/opencode/athena-state.json`
- Tracks current story, session ID, and history
- Survives session restarts

### Bridge Commands
- Defined as Markdown files in `commands/`
- Copied to `~/.config/opencode/command/` during install
- Invoke plugin tools internally

### Todo Synchronization

When implementing BMAD stories, todos are automatically synced with story checkboxes:

**Format:** `[{storyId}Δ{section}] {task description}`

Examples:
- `[2.3ΔAC1] Implement login endpoint` - Acceptance Criterion 1
- `[2.3ΔTask3] Write integration tests` - Task 3
- `[2.3ΔFix2] Fix hardcoded secret` - Implementation Notes finding

**Workflow:**
1. `athena_get_story` loads story and returns todos in response
2. Agent calls `todowrite` to populate todo list
3. Agent marks todos complete as work progresses
4. Hook automatically updates BMAD file checkboxes
5. BMAD files remain the source of truth

**After compaction:**
- Todo format includes story ID and section
- Agent can read story file for full context
- Hook parses todo ID to find correct BMAD file and line

**Key files:**
- `src/plugin/utils/todo-sync.ts` - Core sync logic
- `src/plugin/hooks/todo-hooks.ts` - Hook handlers
- `src/plugin/hooks/tool-hooks.ts` - Integration with tool execution

## Common Tasks

### Adding a New Tool
1. Create tool file in `src/plugin/tools/`
2. Export from `src/plugin/tools/index.ts`
3. Add to tools object returned by `createTools()`
4. Document in README if user-facing

### Adding a Bridge Command
1. Create `commands/athena-{name}.md`
2. Define prompt with tool invocations
3. Update FileManager to copy during install

### Modifying Config Schema
1. Update Zod schema in `src/shared/schemas.ts`
2. Update generator in `src/cli/generators/`
3. Update JSON schema in `config/schemas/`
4. **CRITICAL**: If you add/remove/rename fields in `athena.json` or `oh-my-opencode.json`, you MUST add a migration (see below)

### Adding a Migration

**When to add a migration** (MANDATORY):
- Adding new fields to `athena.json` config schema
- Removing fields from `athena.json` config schema
- Renaming fields in `athena.json` or `oh-my-opencode.json`
- Changing default values that affect existing installations
- Any breaking change to config structure

**How to add a migration**:

1. **Increment version in `package.json`**:
   ```bash
   npm version patch  # For new fields/non-breaking changes
   npm version minor  # For new features with migrations
   npm version major  # For breaking changes
   ```

2. **Add migration to `src/cli/utils/migrations/migrations.ts`**:
   ```typescript
   export const MIGRATIONS: Migration[] = [
     // ... existing migrations ...
     {
       fromVersion: "0.5.0",  // Version users are upgrading FROM
       toVersion: "0.6.0",    // Version users are upgrading TO
       description: "Add new feature flag: enableAwesomeFeature",
       migrateAthena: (config) => {
         const features = (config.features as Record<string, unknown>) || {};
         if (features.enableAwesomeFeature === undefined) {
           features.enableAwesomeFeature = true; // Set safe default
         }
         return { ...config, features };
       },
       // Optional: migrate oh-my-opencode.json if needed
       migrateOmo: (config) => {
         // Transform oh-my-opencode config here
         return config;
       },
     },
   ];
   ```

3. **Migration best practices**:
   - Always check if field exists before setting it (`if (field === undefined)`)
   - Use safe defaults (don't break existing setups)
   - Preserve user customizations
   - Add descriptive `description` field
   - Keep migrations idempotent (safe to run multiple times)
   - Migrations run in order based on `fromVersion` (uses semver)

4. **Add test for migration** in `tests/cli/migrations.test.ts`:
   ```typescript
   it("adds enableAwesomeFeature when migrating from 0.5.0 to 0.6.0", () => {
     const oldAthena = {
       version: "0.5.0",
       features: { existingFeature: true },
     };

     const result = migrateConfigs(oldAthena, {}, "0.5.0");

     const features = result.athenaConfig.features as Record<string, unknown>;
     expect(features.enableAwesomeFeature).toBe(true);
     expect(features.existingFeature).toBe(true); // Preserved!
   });
   ```

5. **Update generator** to include new field:
   - Add to `src/cli/generators/athena-config.ts` or `omo-config.ts`
   - Ensure fresh installs get the new field

**Migration system architecture**:
- Migrations are applied automatically during upgrade
- Users see what migrations were applied
- Breaking changes (major version bumps) warn the user
- All migrations create automatic backups before running
- Migration chain supports ALL versions (from 0.0.1 to current)

### Upgrade Command Architecture

The `upgrade` command consolidates version checking and config migrations:

**Command structure**:
```bash
npx opencode-athena upgrade           # Full upgrade with prompts
npx opencode-athena upgrade --check   # Check for updates without installing
npx opencode-athena upgrade --yes     # Skip confirmation prompts
```

**What it does**:
1. **Version checking**: Queries npm registry for latest versions (respects release channels)
2. **Comparison display**: Shows `current -> latest` for each package
3. **Config migrations**: Applies necessary schema transformations
4. **Package installation**: Installs from npm with correct version tags
5. **Bridge commands**: Updates command files to latest

**Release channel handling**:
- Beta versions (e.g., `0.8.1-beta.2`) → checks `@beta` tag
- Alpha versions (e.g., `0.8.1-alpha.1`) → checks `@alpha` tag
- Stable versions (e.g., `0.8.1`) → checks `@latest` tag

**Migration behavior**:
- Migrations tied to release versions only (not beta/alpha)
- `semver.coerce()` normalizes pre-release tags for migration logic
- Beta-to-beta upgrades skip migrations (same base version)
- Beta-to-release upgrades run migrations for that release

## Testing Locally

```bash
# Build
npm run build

# Run CLI locally
node dist/cli/index.js install

# Run tests (watch mode - for interactive development)
npm test

# Run tests once and exit (for CI/automation - USE THIS IN AGENTS)
npm run test:run

# Run tests with coverage
npm run test:coverage

# Type check only
npm run typecheck
```

**Important for AI agents**: Always use `npm run test:run` instead of `npm test`. The default `npm test` runs Vitest in watch mode which will hang indefinitely waiting for input.

## External Dependencies

- **oh-my-opencode**: Provides Sisyphus, Oracle, Librarian, LSP tools
- **@opencode-ai/plugin**: Plugin SDK for OpenCode
- **BMAD METHOD**: Planning framework (installed separately per-project)
