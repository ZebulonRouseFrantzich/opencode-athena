# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **GitHub Copilot Support**
  - GitHub Copilot as a model provider option during installation
  - Plan-based model filtering (Free/Pro/Pro+/Business/Enterprise)
  - 15 Copilot-routed models: Claude Sonnet 4, Claude 3.5 Sonnet, GPT-4o, GPT-4.1, o3-mini, o4-mini, Gemini 2.5 Pro
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

### Changed

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
