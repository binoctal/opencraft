[中文](README.zh-CN.md) | **English**

# Opencraft

Development governance middleware for Claude Code — auto-detecting tech stacks, enforcing quality gates, and keeping your project healthy through hooks.

## What It Does

Opencraft is a **zero-configuration governance layer** that works automatically:

- **Auto-detection** — Scans your project for tech stack fingerprints (go.mod, tsconfig.json, pyproject.toml, etc.) on every session start
- **Automatic verification** — Runs project-appropriate checks after every `git commit`
- **Health monitoring** — Tracks CLAUDE.md size, tech stack changes, and unverified modifications
- **Context injection** — Provides project governance context to Claude at session start

## Install

```bash
claude plugin marketplace add binoctal/opencraft
claude plugin install opencraft
```

That's it. No additional setup required.

## Uninstall

```bash
claude plugin uninstall opencraft          # Remove plugin
claude plugin marketplace remove opencraft # Remove marketplace source
```

## How It Works

### Session Start

When you start a conversation, opencraft:

1. Detects your project's tech stack from fingerprint files
2. Generates `.claude/opencraft-profile.json` with verification commands
3. Injects governance context into the conversation
4. Shows a one-line status summary

### Git Commit

After every `git commit`, opencraft automatically runs verification commands from the profile. Passes silently, blocks on failure.

### Session End

When you end a conversation, opencraft checks for uncommitted changes and reminds you if anything needs verification.

## Supported Tech Stacks

| Fingerprint | Tech Stack | Default Verification |
|-------------|-----------|---------------------|
| `go.mod` | Go | `go vet ./...`, `go test ./...` |
| `tsconfig.json` | TypeScript | `npx tsc --noEmit` |
| `package.json` (no tsconfig) | JavaScript | `npm test` |
| `pyproject.toml` / `setup.py` | Python | `pytest` |
| `Cargo.toml` | Rust | `cargo check`, `cargo test` |
| `pom.xml` | Java | `mvn test` |
| `build.gradle` | Java | `gradle test` |

Multi-stack projects are fully supported — all detected stacks contribute verification commands.

### Monorepo Support

Opencraft detects monorepo setups and uses workspace-aware commands:

| Monorepo Tool | Detected By | Verification |
|---------------|-------------|-------------|
| pnpm | `pnpm-workspace.yaml` | `pnpm -r run test` |
| turbo | `turbo.json` | `turbo run test` (preferred when present) |
| Lerna | `lerna.json` | `npx lerna run test` |
| Nx | `nx.json` | `nx run-many --target=test` |
| npm workspaces | `package.json` workspaces | `npm run test --workspaces` |

When turbo is detected alongside another monorepo tool (e.g., pnpm + turbo), turbo commands take priority for efficiency. Sub-project tech stacks are automatically scanned and included in the profile.

## Skills

| Skill | Description |
|-------|-------------|
| `opencraft:setup` | View or adjust the auto-generated governance profile |
| `opencraft:verify` | Manually run verification commands from the profile |
| `opencraft:onboard` | Guided walkthrough of governance concepts |

Most of the time, you won't need any of these — governance works automatically through hooks.

## Hooks

| Hook | Event | What It Does |
|------|-------|-------------|
| `session-start.cjs` | SessionStart | Detects tech stack, generates profile, injects governance context |
| `post-tool-use.cjs` | PostToolUse (git commit) | Runs verification commands from profile, blocks on failure |
| `stop.cjs` | Stop | Checks for uncommitted changes, reminds about verification |

## Visibility

Opencraft follows a three-level visibility strategy:

- **Silent (Level 0)** — Verification passes: no output
- **Info (Level 1)** — Status summary at session start: `[opencraft] ✅ Go | 2 changes | 42-line CLAUDE.md`
- **Blocking (Level 2)** — Verification failure: error details + commit rejected

## Compatible Plugins

| Plugin | Focus | Compatible? |
|--------|-------|-------------|
| [Superpowers](https://github.com/anthropics/claude-plugins-official) | TDD, debugging, code review | Yes — complementary |
| [OpenSpec](https://github.com/fission-ai/openspec) | Change management, structured workflows | Yes — opencraft reads active changes for context |

No conflicts — opencraft uses `<opencraft-context>` tags that don't interfere with other plugins.

## Project-Level Hooks

Templates for project-specific guards are in `templates/project-hooks/`:

- `deploy-safety-guard.js` — Pre-deploy checks (tsc, vitest, vite build, wrangler config)
- `submodule-push-guard.js` — Ensures submodules are committed and pushed first

## License

MIT
