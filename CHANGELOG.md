# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **GitHub Copilot Support**
  - GitHub Copilot as a model provider option during installation
  - Plan-based model filtering (Free/Pro/Pro+/Business/Enterprise)
  - 14 Copilot-routed models: Claude Haiku 4.5, Sonnet 4, Sonnet 4.5, Opus 4.1, Opus 4.5, GPT-4.1, GPT-5, GPT-5-mini, GPT-5.1, GPT-5.1-codex, GPT-5.2, Gemini 2.5 Pro, Gemini 3 Flash, Gemini 3 Pro
  - New `copilot-only` preset for users with only GitHub Copilot access
  - Automatic preference for direct provider models when both available

- **Model Settings System**
  - Per-agent `temperature` and `thinkingLevel` configuration
  - Model-family-aware temperature defaults (e.g., Claude thinking models get higher base temp)
  - ThinkingLevel maps to provider-specific parameters:
    - Anthropic: `thinking.budget_tokens`
    - OpenAI: `reasoning_effort`
    - Google: `thinking_level`
  - User overrides in `athena.json` under `models.settings`

- **New Tests**
  - `tests/cli/copilot-models.test.ts` - Copilot plan-based model filtering
  - `tests/plugin/model-params.test.ts` - Temperature and thinkingLevel resolution

- **Custom Models Support**
  - Add custom model definitions via `models.custom` in config
  - Custom models can override built-in models or add new ones
  - Capabilities hints: `thinking`, `contextWindow`, `supportsTemperature`

- **Doctor Command Enhancements**
  - Config version freshness check
  - GitHub Copilot authentication status check (when enabled)

- **BMAD ↔ Todo Sync**
  - Automatic synchronization between BMAD story checkboxes and oh-my-opencode's todo tool
  - Write-through cache model: BMAD files remain source of truth
  - Athena-themed todo format: `[{storyId}Δ{section}] {task}` (e.g., `[2.3ΔAC1] Implement login`)
  - Content-based matching: robust to line number shifts from file edits
  - Compaction-safe: todos include story context for post-compaction recovery
  - Merge strategy: user todos preserved, BMAD todos synced per-story
  - Priority detection from BMAD content (Critical/High → high, etc.)
  - New config flag: `features.todoSync` (default: true)
  - New files: `src/plugin/utils/todo-sync.ts`, `src/plugin/hooks/todo-hooks.ts`
  - Integration with `athena_get_story` and `todowrite` hooks

### Changed

- **Upgrade Command Consolidation**
  - Consolidated and removed `update` command - use `upgrade` instead
  - `upgrade` now checks npm registry for latest versions before upgrading
  - Added `--check` flag to `upgrade` for dry-run version checking
  - `upgrade` shows current → latest version comparison for all packages
  - Respects release channels (beta/alpha/latest) when checking for updates
  - Automatically installs correct package versions from npm registry
  - Fixed critical bug where upgrade didn't install npm packages

- Updated all presets with `githubCopilot` subscription support
- Updated JSON schema with `agentSettings` and `customModel` definitions
- Config loader now provides backwards compatibility for missing `githubCopilot` config

## [0.0.1] - TBD

### Added

- **CLI Installer** (`npx opencode-athena install`)
  - Interactive setup wizard for LLM subscriptions (Claude, OpenAI, Google)
  - Preset configurations (minimal, standard, enterprise, solo-quick)
  - Automatic oh-my-opencode configuration
  - Bridge command installation

- **OpenCode Plugin**
  - `athena_get_story` - Load BMAD story context for implementation
  - `athena_update_status` - Update sprint-status.yaml
  - `athena_get_context` - Get current story context
  - `athena_parallel` - Multi-story parallel execution
  - `athena_config` - View/modify Athena configuration

- **Bridge Commands**
  - `/athena-dev` - Implement story with Sisyphus
  - `/athena-review` - Combined quality gate
  - `/athena-debug` - Debug with Oracle
  - `/athena-research` - Research with Librarian
  - `/athena-parallel` - Multi-story execution
  - `/athena-status` - Sprint status management
  - `/athena-info` - Toolkit information

- **Session Hooks**
  - Story context injection on session.idle
  - Context preservation during compaction

- **Story Tracker**
  - Persistent story state across sessions
  - Sprint progress tracking

### Dependencies

- oh-my-opencode (managed)
- BMAD METHOD v6 (per-project)
- opencode-antigravity-auth (optional, for Google Workspace)
- opencode-openai-codex-auth (optional, for OpenAI)

[Unreleased]: https://github.com/ZebulonRouseFrantzich/opencode-athena/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/ZebulonRouseFrantzich/opencode-athena/releases/tag/v0.0.1
