# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - TBD

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

[Unreleased]: https://github.com/ZebulonRouseFrantzich/opencode-athena/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ZebulonRouseFrantzich/opencode-athena/releases/tag/v1.0.0
