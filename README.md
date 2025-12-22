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

## Publishing Releases

This package uses **Trusted Publishing (OIDC)** for secure, credential-free releases via GitHub Actions.

### For Maintainers: Creating a New Release

1. **Update version:**
   ```bash
   npm version patch  # 0.0.3 -> 0.0.4
   npm version minor  # 0.1.0 -> 0.2.0
   npm version major  # 1.0.0 -> 2.0.0
   ```

2. **Commit and push:**
   ```bash
   git add package.json
   git commit -m "Bump version to X.Y.Z"
   git push origin main
   ```

3. **Create and push tag:**
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. **Monitor:** GitHub Actions publishes automatically
   - Watch: [Actions](https://github.com/ZebulonRouseFrantzich/opencode-athena/actions)
   - Verify: [npm package](https://www.npmjs.com/package/opencode-athena)
   - Check: [GitHub Releases](https://github.com/ZebulonRouseFrantzich/opencode-athena/releases)

### Security Features

**Trusted Publishing (OIDC):**
- ✅ Zero stored credentials (no npm tokens in GitHub)
- ✅ Short-lived authentication (hours, not years)
- ✅ Cannot be leaked (runtime-only tokens)
- ✅ Automatic provenance attestations
- ✅ OpenSSF industry standard

**Provenance Attestations:**

Every release includes cryptographically signed provenance via [Sigstore](https://www.sigstore.dev/), providing:
- Verifiable link between npm package and GitHub source code
- Proof of which GitHub Actions workflow built the package
- Immutable transparency log entry
- Supply chain security guarantees

**Verify any published version:**
```bash
npm install opencode-athena
npm audit signatures
```

### CI/CD Configuration

The release workflow uses:
- **Trusted Publishing** - OIDC authentication (no long-lived tokens)
- **npm CLI 11+** - Required for Trusted Publishing support
- **GitHub-hosted runners** - Secure, isolated build environment
- **Automatic provenance** - Generated without `--provenance` flag

Trusted Publisher configuration:
- **Provider:** GitHub Actions
- **Repository:** `ZebulonRouseFrantzich/opencode-athena`
- **Workflow:** `release.yml`
- **Permissions:** `id-token: write`, `contents: write`

### Troubleshooting Releases

| Issue | Solution |
|-------|----------|
| "Unable to authenticate" | Verify Trusted Publisher config on npmjs.com matches exactly (case-sensitive) |
| Workflow filename mismatch | Must be `release.yml` (not `Release.yml` or full path) |
| npm version error | Ensure npm 11.5.1+ (workflow upgrades automatically) |
| No provenance generated | Automatic with Trusted Publishing - check npmjs.com package page |
| Self-hosted runner error | Use GitHub-hosted runners only (required for OIDC) |

For detailed setup: [`.github/workflows/release.yml`](.github/workflows/release.yml)

### Why Trusted Publishing?

We use Trusted Publishing instead of traditional npm tokens because:
- **Security:** Eliminates risks from npm credential breaches
- **Compliance:** Implements OpenSSF Trusted Publishers standard
- **Simplicity:** No manual token management or rotation
- **Transparency:** Automatic provenance provides supply chain visibility

Learn more: [npm Trusted Publishing Documentation](https://docs.npmjs.com/trusted-publishers)

## Credits

Built on top of:

- [OpenCode](https://opencode.ai) by SST
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) by code-yeongyu
- [BMAD METHOD](https://github.com/bmad-method/bmad-method) by bmad-method

## License

MIT-0 (MIT No Attribution) - See [LICENSE](LICENSE) for details.
