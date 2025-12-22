---
description: Display OpenCode Athena configuration and toolkit information
---

# Athena Info - Toolkit Information

Display current OpenCode Athena configuration, available capabilities, and troubleshooting information.

## View Current Configuration

Call **athena_config** to see the current setup:

```
athena_config()
```

This displays:
- Athena version
- Configured LLM providers
- Agent model assignments
- BMAD settings
- Enabled features
- MCP servers

## Configuration Sections

### View Specific Section

To view only a specific section:

```
athena_config({ section: "subscriptions" })
athena_config({ section: "models" })
athena_config({ section: "bmad" })
athena_config({ section: "features" })
athena_config({ section: "mcps" })
```

### Section Details

**Subscriptions:**
- Which LLM providers are configured (Claude, OpenAI, Google)
- Authentication status

**Models:**
- Agent model assignments
- Sisyphus model (main orchestrator)
- Oracle model (deep reasoning)
- Librarian model (research)
- Frontend Engineer model
- Document Writer model
- Multimodal Looker model

**BMAD:**
- Methodology track
- Auto status update setting
- Parallel story limit
- BMAD directory location

**Features:**
- Bridge commands enabled
- Auto sprint status updates
- Parallel execution
- Notifications
- Context monitoring
- Comment checker
- LSP tools

**MCPs:**
- context7 (documentation lookup)
- websearch_exa (web search)
- grep_app (GitHub code search)

## Configuration Files

Configuration is stored in these locations:

### Global Configuration (all projects)

```
~/.config/opencode/
├── athena.json          # Athena-specific settings
├── oh-my-opencode.json  # Agent model configuration
├── opencode.json        # Plugin registration
└── package.json         # Installed plugin packages
```

### Project Configuration (overrides global)

```
[project]/.opencode/
├── athena.json          # Project-specific Athena settings
└── oh-my-opencode.json  # Project-specific agent models
```

## Toolkit Capabilities

### Bridge Commands

| Command | Description | Invokes |
|---------|-------------|---------|
| `/athena-dev` | Implement a BMAD story | Sisyphus + subagents |
| `/athena-review` | Quality gate review | Oracle (code + adversarial) |
| `/athena-debug` | Debug complex issues | Oracle |
| `/athena-research` | Research patterns/docs | Librarian |
| `/athena-status` | Sprint status management | Athena tools |
| `/athena-info` | This command | athena_config |
| `/athena-parallel` | Parallel story execution | (Planned) |

### Available Subagents

| Agent | Model | Specialty |
|-------|-------|-----------|
| **Sisyphus** | (configured) | Orchestration, implementation |
| **Oracle** | (configured) | Deep reasoning, debugging, code review |
| **Librarian** | (configured) | Research, documentation, examples |
| **Explore** | (configured) | Fast codebase search |
| **Frontend UI/UX Engineer** | (configured) | Visual design, UI implementation |
| **Document Writer** | (configured) | Documentation |
| **Multimodal Looker** | (configured) | Image/PDF analysis |

### Available Tools

**Athena Tools:**
- `athena_get_story` - Load BMAD story context
- `athena_update_status` - Update sprint status
- `athena_get_context` - Get cached story context
- `athena_config` - View configuration
- `athena_parallel` - Parallel story execution (planned)

**oh-my-opencode Tools:**
- LSP tools (hover, goto definition, find references, rename, etc.)
- AST-grep tools (search, replace)
- Background agent tools
- Interactive bash (tmux)

**MCP Tools:**
- context7 (documentation lookup)
- websearch_exa (web search)
- grep_app (GitHub search)

## Modifying Configuration

### Option 1: Reinstall with Different Options

```bash
npx opencode-athena install
```

Interactive installer will prompt for new configuration.

### Option 2: Use a Preset

```bash
npx opencode-athena install --preset minimal
npx opencode-athena install --preset standard
npx opencode-athena install --preset enterprise
npx opencode-athena install --preset solo-quick
```

### Option 3: Edit Config Files Directly

**Edit Athena settings:**
```bash
# Global
nano ~/.config/opencode/athena.json

# Project-specific
nano .opencode/athena.json
```

**Edit agent models:**
```bash
# Global
nano ~/.config/opencode/oh-my-opencode.json

# Project-specific
nano .opencode/oh-my-opencode.json
```

### Option 4: Update Specific Settings

After editing config files, restart OpenCode to apply changes.

## Troubleshooting

### Check Installation Health

Run the doctor command in terminal:

```bash
npx opencode-athena doctor
```

This checks:
- Node.js version
- OpenCode version
- Plugin installation
- Configuration validity
- Authentication status

### Auto-Fix Common Issues

```bash
npx opencode-athena doctor --fix
```

This will attempt to:
- Reinstall missing plugins
- Fix broken symlinks
- Repair config files
- Re-copy bridge commands

### Common Issues

| Issue | Solution |
|-------|----------|
| Plugin not loading | Run `doctor --fix` to reinstall |
| Auth errors | Run `opencode auth login` for each provider |
| BMAD not found | Run `npx bmad-method@alpha install` in project |
| Commands not available | Verify commands in `~/.config/opencode/command/` |
| Agent model errors | Check `oh-my-opencode.json` configuration |

### Verify Plugin Installation

Check installed plugins:

```bash
ls ~/.config/opencode/node_modules/ | grep -E '(opencode-athena|oh-my-opencode)'
```

Check OpenCode config:

```bash
cat ~/.config/opencode/opencode.json | grep plugin
```

Should include:
- `opencode-athena/plugin`
- `oh-my-opencode`

### Check Authentication

For each provider you've configured:

```bash
opencode auth login
# Select provider and authenticate
```

## Version Information

### Check Versions

```bash
# Athena CLI version
npx opencode-athena --version

# Installed package versions
cd ~/.config/opencode
npm list opencode-athena oh-my-opencode
```

### Update to Latest

```bash
npx opencode-athena update
```

This updates:
- opencode-athena CLI
- oh-my-opencode plugin
- Auth plugins
- Bridge commands

## Getting Help

### Documentation

- [OpenCode Athena GitHub](https://github.com/ZebulonRouseFrantzich/opencode-athena)
- [oh-my-opencode GitHub](https://github.com/code-yeongyu/oh-my-opencode)
- [BMAD METHOD GitHub](https://github.com/bmad-method/bmad-method)

### Report Issues

If you encounter bugs:

1. Run `npx opencode-athena doctor` and save output
2. Note what you were doing when the issue occurred
3. Open an issue on the appropriate GitHub repo

### Quick Reference Card

```
┌────────────────────────────────────────────────────────────┐
│                    ATHENA QUICK REFERENCE                   │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  COMMANDS:                                                  │
│    /athena-dev      → Implement a story                    │
│    /athena-review   → Quality gate review                  │
│    /athena-debug    → Debug with Oracle                    │
│    /athena-research → Research with Librarian              │
│    /athena-status   → Sprint status                        │
│    /athena-info     → This help                            │
│                                                             │
│  AGENTS:                                                    │
│    @oracle          → Deep reasoning, code review          │
│    @librarian       → Research, docs, examples             │
│    @explore         → Fast codebase search                 │
│    @frontend-ui-ux-engineer → UI/UX work                   │
│                                                             │
│  TOOLS:                                                     │
│    athena_get_story      → Load story context              │
│    athena_update_status  → Update story status             │
│    athena_config         → View configuration              │
│                                                             │
│  CLI:                                                       │
│    npx opencode-athena install   → Install/configure       │
│    npx opencode-athena update    → Update plugins          │
│    npx opencode-athena doctor    → Diagnose issues         │
│    npx opencode-athena info      → Show config             │
│                                                             │
└────────────────────────────────────────────────────────────┘
```
