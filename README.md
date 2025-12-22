# OpenCode Athena

> **Strategic wisdom meets practical execution**

Unified [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) + [BMAD METHOD v6](https://github.com/bmad-method/bmad-method) toolkit for [OpenCode](https://opencode.ai).

[![npm version](https://img.shields.io/npm/v/opencode-athena)](https://www.npmjs.com/package/opencode-athena)
[![License: MIT-0](https://img.shields.io/badge/License-MIT--0-yellow.svg)](https://opensource.org/licenses/MIT-0)

## What is Athena?

OpenCode Athena bridges the gap between **BMAD METHOD's rigorous planning** and **oh-my-opencode's superior execution**:

- **Planning** (BMAD): PRD → Architecture → Epics → Stories
- **Execution** (oh-my-opencode): Sisyphus + Oracle + Librarian + LSP tools + parallel agents
- **Bridge** (Athena): Automatic handoff, status tracking, context injection

| Without Athena | With Athena |
|----------------|-------------|
| Manual oh-my-opencode setup | One-command installation |
| Manual BMAD ↔ Sisyphus handoff | Automated bridge commands |
| Manual sprint-status.yaml updates | Auto-tracking |
| Separate context management | Unified context injection |
| Manual auth configuration | Guided setup wizard |

## Quick Start

```bash
npx opencode-athena install
```

The interactive installer will:
1. Ask about your LLM subscriptions (Claude, OpenAI, Google)
2. Configure oh-my-opencode with optimal agent models
3. Set up authentication plugins
4. Install bridge commands

## Requirements

- [OpenCode](https://opencode.ai/docs) 1.0.132+
- Node.js 20+
- One or more LLM subscriptions:
  - Claude Pro/Max (recommended)
  - ChatGPT Plus/Pro
  - Google/Gemini

## Commands

After installation, these commands are available in OpenCode:

| Command | Description |
|---------|-------------|
| `/athena-dev` | Implement current BMAD story with Sisyphus |
| `/athena-review` | Combined quality gate (BMAD + oh-my-opencode) |
| `/athena-debug` | Debug with Oracle (GPT-5.1 reasoning) |
| `/athena-research` | Research with Librarian + MCPs |
| `/athena-parallel` | Execute multiple stories in parallel |
| `/athena-status` | View/update sprint status |
| `/athena-info` | Show toolkit configuration |

## Workflow

### 1. Plan with BMAD (Phases 1-3)

Use BMAD agents for planning:

```
Load PM agent → *prd
Load Architect agent → *create-architecture
Load SM agent → *sprint-planning → *create-story
```

### 2. Implement with Athena (Phase 4)

Use Athena bridge commands:

```
/athena-dev        # Load story, implement with Sisyphus
/athena-review     # Quality gate
/athena-status     # Mark complete, get next story
```

### 3. Repeat

Continue until sprint is complete, then run retrospective with BMAD SM.

## Configuration

Configuration files are stored in `~/.config/opencode/`:

- `athena.json` - Athena-specific settings
- `oh-my-opencode.json` - Agent model configuration
- `opencode.json` - Plugin registration

### Presets

Use `--preset` during installation:

```bash
npx opencode-athena install --preset minimal    # Bare essentials
npx opencode-athena install --preset standard   # Recommended (default)
npx opencode-athena install --preset enterprise # Full features
npx opencode-athena install --preset solo-quick # Solo dev quick flow
```

### Project Overrides

Create `.opencode/athena.json` in your project root to override global settings.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OPENCODE ATHENA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         CLI Installer                                │   │
│  │   npx opencode-athena install    npx opencode-athena doctor         │   │
│  │   npx opencode-athena update     npx opencode-athena uninstall      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       OpenCode Plugin                                │   │
│  │   Custom Tools:                    Event Hooks:                      │   │
│  │   • athena_get_story              • session.idle                     │   │
│  │   • athena_update_status          • session.created                  │   │
│  │   • athena_get_context            • tool.execute.before              │   │
│  │   • athena_parallel               • tool.execute.after               │   │
│  │   • athena_config                 • session.compacting               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Bridge Commands                                │   │
│  │   /athena-dev       /athena-review      /athena-debug               │   │
│  │   /athena-research  /athena-parallel    /athena-status              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────┐   │
│  │    oh-my-opencode    │  │    BMAD METHOD v6    │  │  Auth Plugins  │   │
│  │      (managed)       │  │   (per-project)      │  │   (managed)    │   │
│  └──────────────────────┘  └──────────────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │  OpenCode   │
                              │   (Base)    │
                              └─────────────┘
```

## Troubleshooting

```bash
npx opencode-athena doctor        # Diagnose issues
npx opencode-athena doctor --fix  # Auto-fix common problems
```

Common issues:

| Issue | Solution |
|-------|----------|
| Plugin not loading | Run `doctor --fix` to reinstall |
| Auth errors | Run `opencode auth login` for each provider |
| BMAD not found | Run `npx bmad-method@alpha install` in your project |
| Commands not available | Verify commands are in `~/.config/opencode/command/` |

## Credits

Built on top of:

- [OpenCode](https://opencode.ai) by SST
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) by code-yeongyu
- [BMAD METHOD](https://github.com/bmad-method/bmad-method) by bmad-method

## License

MIT-0 (MIT No Attribution) - See [LICENSE](LICENSE) for details.
