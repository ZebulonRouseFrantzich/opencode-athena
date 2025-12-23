# OpenCode Athena

> **Strategic wisdom meets practical execution**

Unified [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) + [BMAD METHOD v6](https://github.com/bmad-code-org/BMAD-METHOD) toolkit for [OpenCode](https://opencode.ai).

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
  - GitHub Copilot (Free/Pro/Pro+/Business/Enterprise)

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
| `/athena-review-story` | Party review stories for security/logic/performance gaps (pre-dev) |

## Workflow

### 1. Plan with BMAD (Phases 1-3)

Use BMAD agents for planning:

```
Load PM agent → *prd
Load Architect agent → *create-architecture
Load SM agent → *sprint-planning → *create-story
```

### 2. Implement with Athena (Phase 4)

Use Athena bridge commands in an iterative loop:

```
/athena-dev        # Load story, implement with Sisyphus
/athena-review     # Quality gate with collaborative discussion
```

**If review passes:**
```
/athena-status     # Mark complete, get next story
```

**If review finds issues:**
1. Sisyphus auto-updates story status to `in_progress`
2. You discuss findings together and decide which to address
3. Sisyphus updates story file with implementation notes
4. Sisyphus recommends: **Stay in session** or **Restart `/athena-dev`**
5. You decide and proceed:
   - **Stay in session**: Continue fixing in current session
   - **Restart**: Exit and run `/athena-dev` again (loads implementation notes)
6. After fixes, run `/athena-review` again (respects previous decisions)

**Iterative Quality Loop:**
```
Implement → Review → Discuss → Fix → Review → ... → PASS
```

**Key Features:**
- Review discussions are preserved in story file
- Subsequent reviews don't re-block on deferred/rejected items
- Checkboxed implementation notes track progress
- Flexible: stay in session for simple fixes, restart for complex rework

### 3. Repeat

Continue until sprint is complete, then run retrospective with BMAD SM.

## Pre-Development Story Review

The `/athena-review-story` command runs a comprehensive "party review" of stories **before** development begins, catching issues when they're cheap to fix (in markdown, not code).

### Usage

```bash
/athena-review-story epic-2       # Review all stories in Epic 2
/athena-review-story 2.3          # Deep dive on Story 2.3
/athena-review-story --thorough   # Force advanced model
```

### 3-Phase Review Architecture

```
┌─────────────────────────────────────────┐
│  PHASE 1: Automated Analysis            │
│  • Oracle finds security/logic gaps     │
│  • Recommends BMAD agents by findings   │
│  • Saves review to docs/reviews/        │
└─────────────────────────────────────────┘
                    │
                    ▼
        User: [Q]uick review or [D]iscuss?
                    │
                   [D]
                    ▼
┌─────────────────────────────────────────┐
│  PHASE 2: Parallel Agent Analysis       │
│  • Architect, DEV, TEA, PM in parallel  │
│  • Each analyzes ALL stories            │
│  • Cross-story pattern detection        │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  PHASE 3: Informed Discussion           │
│  • BMAD *party-mode with pre-context    │
│  • Interactive agent debate             │
│  • Decisions captured to story files    │
└─────────────────────────────────────────┘
```

### Finding Categories

| Category | Icon | Examples |
|----------|------|----------|
| Security | 🔒 | Missing auth, input validation, data exposure |
| Logic | 🧠 | Edge cases, error handling, race conditions |
| Best Practices | ✨ | Anti-patterns, testing gaps, accessibility |
| Performance | ⚡ | N+1 queries, caching, large data handling |

### Agent Selection

Agents are recommended based on finding types:

| Finding Type | Agents Recommended |
|--------------|-------------------|
| Security issues | Architect (Winston), DEV (Amelia), TEA (Murat) |
| Logic gaps | DEV, TEA, Analyst (Mary) |
| Performance concerns | Architect, DEV |
| Best practice issues | DEV, Tech Writer (Paige) |
| High severity (any) | PM (John) - always required |

### Quick vs Full Review

- **Quick Review [Q]**: Accept Phase 1 findings, skip discussion. Best for low-severity issues.
- **Full Discussion [D]**: Run Phases 2-3 with parallel agents and party-mode debate. Best for complex or high-severity findings.

## Configuration

Configuration files are stored in `~/.config/opencode/`:

- `athena.json` - Athena-specific settings
- `oh-my-opencode.json` - Agent model configuration
- `opencode.json` - Plugin registration

### Presets

Use `--preset` during installation:

```bash
npx opencode-athena install --preset minimal     # Bare essentials
npx opencode-athena install --preset standard    # Recommended (default)
npx opencode-athena install --preset enterprise  # Full features
npx opencode-athena install --preset solo-quick  # Solo dev quick flow
npx opencode-athena install --preset copilot-only # GitHub Copilot users
```

### Project Overrides

Create `.opencode/athena.json` in your project root to override global settings.

### Model Settings

Athena provides fine-grained control over model behavior through `temperature` and `thinkingLevel` settings. These can be configured per agent role in `athena.json`:

```json
{
  "models": {
    "settings": {
      "sisyphus": {
        "temperature": 0.3,
        "thinkingLevel": "medium"
      },
      "oracle": {
        "thinkingLevel": "high"
      },
      "librarian": {
        "temperature": 0.2
      }
    }
  }
}
```

**Temperature** controls response randomness (0.0-2.0). Lower values = more focused, higher = more creative. Defaults are model-family-aware (e.g., Claude thinking models use higher defaults).

**ThinkingLevel** controls reasoning depth for supported models:
- `"low"` - Quick responses, minimal reasoning
- `"medium"` - Balanced (default)
- `"high"` - Deep reasoning, slower

ThinkingLevel maps to provider-specific parameters:
| Provider | Parameter | Values |
|----------|-----------|--------|
| Anthropic | `thinking.budget_tokens` | 1024 / 8192 / 32768 |
| OpenAI | `reasoning_effort` | `"low"` / `"medium"` / `"high"` |
| Google | `thinking_level` | `"LOW"` / `"MEDIUM"` / `"HIGH"` |

Note: Temperature and thinkingLevel are not supported for GitHub Copilot-routed models.

### Custom Models

Add custom models to use models not in the built-in list. Custom models can override built-in models or add entirely new ones:

```json
{
  "models": {
    "sisyphus": "custom/my-finetuned-model",
    "custom": [
      {
        "id": "custom/my-finetuned-model",
        "name": "My Fine-tuned Model",
        "provider": "openai",
        "description": "Custom fine-tuned GPT for our codebase",
        "capabilities": {
          "thinking": false,
          "contextWindow": 128000,
          "supportsTemperature": true
        }
      },
      {
        "id": "anthropic/claude-4-opus",
        "name": "Claude 4 Opus (Override)",
        "provider": "anthropic",
        "description": "Override built-in model with custom settings"
      }
    ]
  }
}
```

Custom model fields:
- `id` (required): Unique identifier, format: `provider/model-name`
- `name` (required): Display name
- `provider` (required): `"anthropic"`, `"openai"`, `"google"`, or `"github-copilot"`
- `description`: Optional description
- `capabilities`: Optional capability hints
  - `thinking`: Whether the model supports extended thinking
  - `contextWindow`: Context window size in tokens
  - `supportsTemperature`: Whether temperature can be adjusted

## GitHub Copilot Support

Athena supports GitHub Copilot as a model provider, allowing you to use Claude, GPT, and Gemini models through your Copilot subscription. This is especially useful for enterprise users who only have access to LLMs through Copilot.

### Setup

1. Run the installer and select "GitHub Copilot" when asked about subscriptions
2. Select your Copilot plan level (determines available models)
3. After installation, authenticate:
   ```bash
   opencode auth login github-copilot
   ```

Or use the `copilot-only` preset:
```bash
npx opencode-athena install --preset copilot-only
```

### Plan Levels and Models

Model availability depends on your GitHub Copilot plan:

| Plan | Claude Models | GPT Models | Gemini Models |
|------|---------------|------------|---------------|
| **Free** | Sonnet 4 | GPT-4o | - |
| **Pro** | Sonnet 4 | GPT-4o, GPT-4.1 | - |
| **Pro+** | Sonnet 4, Claude 3.5 Sonnet | GPT-4o, GPT-4.1, o3 mini, o4 mini | Gemini 2.5 Pro |
| **Business** | Sonnet 4, Claude 3.5 Sonnet | GPT-4o, GPT-4.1, o3 mini, o4 mini | Gemini 2.5 Pro |
| **Enterprise** | Sonnet 4, Claude 3.5 Sonnet | GPT-4o, GPT-4.1, o3 mini, o4 mini | Gemini 2.5 Pro |

### How It Works

GitHub Copilot acts as a proxy to multiple LLM providers. When you configure a Copilot-routed model (e.g., `github-copilot/claude-sonnet-4`), requests are sent through GitHub's API.

**Naming convention:** Copilot-routed models use the format `github-copilot/{model}` (e.g., `github-copilot/gpt-4o`).

**Priority behavior:** If you have both direct provider access and Copilot access (e.g., Claude Pro + Copilot), Athena prefers direct provider models for better feature support.

### Limitations

Models accessed through GitHub Copilot have some limitations compared to direct provider access:

- **No temperature control**: Copilot strips temperature parameters
- **No thinking/reasoning modes**: Extended thinking (Claude), reasoning effort (OpenAI), and thinking level (Google) are not supported
- **Rate limits**: Subject to Copilot's rate limits rather than provider limits
- **Feature lag**: New model features may not be immediately available

For full model capabilities, use direct provider subscriptions when possible.

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
│  │   /athena-dev       /athena-review        /athena-debug             │   │
│  │   /athena-research  /athena-parallel      /athena-status            │   │
│  │   /athena-review-story                                              │   │
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
- [BMAD METHOD](https://github.com/bmad-code-org/BMAD-METHOD) by bmad-code-org

## License

MIT-0 (MIT No Attribution) - See [LICENSE](LICENSE) for details.
