---
description: Display OpenCode Athena configuration and toolkit information
---

# Athena Info - Toolkit Information

Display information about the current OpenCode Athena configuration.

## What This Shows

Running this command will display:

### Configuration
- Athena version
- Configured LLM providers (Claude, OpenAI, Google)
- Agent model assignments

### BMAD Settings
- Default methodology track
- Auto status update setting
- Parallel story limit

### Enabled Features
- BMAD Bridge commands
- Auto sprint status updates
- Parallel execution
- Notifications
- Context monitoring
- Comment checker
- LSP tools

### MCP Servers
- context7 (documentation)
- exa (web search)
- grep_app (GitHub search)

## CLI Alternative

You can also run from the command line:

```bash
opencode-athena info
```

This provides the same information plus:
- Prerequisites status (Node.js, OpenCode versions)
- Installed plugin versions
- Configuration file paths

## Modifying Configuration

To change configuration:

1. **Reinstall with different options:**
   ```bash
   opencode-athena install
   ```

2. **Edit config files directly:**
   - `~/.config/opencode/athena.json` - Athena settings
   - `~/.config/opencode/oh-my-opencode.json` - Agent models
   - `~/.config/opencode/opencode.json` - Plugins

3. **Use athena_config tool:**
   ```
   athena_config({ action: "set", key: "bmad.parallelStoryLimit", value: 5 })
   ```

## Troubleshooting

If something isn't working:
1. Run `npx opencode-athena doctor` in terminal
2. Check that auth is configured for all providers
3. Verify BMAD is installed in the project
