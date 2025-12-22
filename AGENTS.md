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

## Testing Locally

```bash
# Build
npm run build

# Run CLI locally
node dist/cli/index.js install

# Run tests
npm test
```

## External Dependencies

- **oh-my-opencode**: Provides Sisyphus, Oracle, Librarian, LSP tools
- **@opencode-ai/plugin**: Plugin SDK for OpenCode
- **BMAD METHOD**: Planning framework (installed separately per-project)
