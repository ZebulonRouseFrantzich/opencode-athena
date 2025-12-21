# OpenCode Athena

> **Strategic Wisdom Meets Practical Execution**

A comprehensive OpenCode plugin that orchestrates [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) and [BMAD METHOD v6](https://github.com/bmad-method/bmad-method) into a unified agentic development experience.

## Overview

OpenCode Athena is a meta-plugin for OpenCode that bridges the gap between strategic planning and practical code execution. Named after the Greek goddess of wisdom and practical crafts, Athena unifies two powerful development methodologies:

- **BMAD METHOD** - Rigorous planning workflows (PRD, Architecture, Stories)
- **oh-my-opencode** - Superior code execution capabilities (Sisyphus, Oracle, Librarian)

## What It Does

| Capability | Description |
|------------|-------------|
| **Unified Installation** | One-command setup for oh-my-opencode with optimal configuration |
| **Bridge Commands** | Seamless handoff between BMAD planning artifacts and Sisyphus execution |
| **Auto Sprint Tracking** | Automatic updates to `sprint-status.yaml` as stories complete |
| **Context Injection** | Unified context management across planning and implementation |
| **Guided Setup** | Interactive wizard for auth and subscription configuration |

## Core Features

### Bridge Commands

- `/athena-dev` - Implement a BMAD story with full Sisyphus capabilities
- `/athena-review` - Combined quality gate with architecture validation
- `/athena-debug` - Debug with Oracle subagent
- `/athena-research` - Research with Librarian subagent
- `/athena-parallel` - Multi-story parallel execution
- `/athena-status` - Sprint status management

### Custom Plugin Tools

- `athena_get_story` - Load story context with architecture and PRD sections
- `athena_update_status` - Update sprint-status.yaml automatically
- `athena_get_context` - Build comprehensive agent context
- `athena_parallel` - Orchestrate parallel story implementation
- `athena_config` - Runtime configuration management

### Intelligent Subagent Routing

Athena automatically routes work to the optimal subagent based on task type:

- **Sisyphus** - Main orchestrator for story implementation
- **Oracle** - Complex debugging and architectural decisions
- **Librarian** - Pattern research and documentation lookup
- **Frontend Engineer** - UI/UX component implementation

## Target Users

- Solo developers or small team leads
- OpenCode users wanting structured BMAD planning
- Teams seeking oh-my-opencode's execution capabilities
- Developers who value automation and best practices

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OPENCODE ATHENA                          │
├─────────────────────────────────────────────────────────────┤
│  CLI Installer          OpenCode Plugin     Bridge Commands │
│  ├─ install             ├─ Custom Tools     ├─ /athena-dev  │
│  ├─ update              ├─ Event Hooks      ├─ /athena-*    │
│  ├─ doctor              └─ Story Tracker    └─ ...          │
│  └─ uninstall                                                │
├─────────────────────────────────────────────────────────────┤
│  oh-my-opencode (managed)  │  BMAD METHOD v6 (per-project)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                         OpenCode (Base)
```

## Project Structure

```
opencode-athena/
├── src/
│   ├── cli/           # CLI installer commands
│   ├── plugin/        # OpenCode plugin (tools, hooks, tracker)
│   └── shared/        # Shared types, constants, schemas
├── commands/          # Bridge command definitions (.md)
├── config/            # Templates, schemas, presets
└── tests/             # Test suites
```

## License

MIT-0 - See [LICENSE](LICENSE) for details.
