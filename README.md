[中文](README.zh-CN.md) | **English**

# Opencraft

Development governance middleware for Claude Code — auto-detecting tech stacks, enforcing quality gates, and keeping your project healthy through hooks.

## What It Does

Opencraft is a **zero-configuration governance layer** that works automatically:

- **Auto-detection** — Scans your project for tech stack fingerprints (go.mod, tsconfig.json, pyproject.toml, etc.) on every session start
- **Automatic verification** — Runs project-appropriate checks after every `git push`
- **Health monitoring** — Tracks CLAUDE.md size, tech stack changes, and unverified modifications
- **Context injection** — Provides project governance context to Claude at session start
- **Secret prevention** — Blocks API keys, tokens, and private keys from being written to source code
- **Branch protection** — Prevents direct pushes to main/master
- **Dependency auditing** — Warns when dependency files are modified
- **CI alignment** — Detects mismatches between local verification and CI workflows
- **Decision continuity** — Reads historical decisions from cccmemory to prevent re-debating settled choices

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
2. Generates `.opencraft/profile.json` with verification commands
3. Checks CI alignment against your governance profile
4. Injects governance context into the conversation
5. Shows a one-line status summary

### Git Push

After every `git push`, opencraft automatically runs verification commands from the profile. Only sub-projects with changed files are verified. Passes silently, blocks on failure.

**Branch protection** blocks direct pushes to `main` and `master`. Use a feature branch instead.

## Governance Hooks

### Secret Leak Prevention

**PreToolUse** on Write/Edit — scans content before it's written to disk.

| Pattern | Service |
|---------|---------|
| `sk-proj-*` | OpenAI project key |
| `sk-*` (48 chars) | OpenAI legacy key |
| `sk_live_*` / `sk_test_*` | Stripe keys |
| `ghp_*` / `gho_*` / `ghu_*` / `ghs_*` | GitHub tokens |
| `xox[bposa]-*` | Slack tokens |
| `AKIA*` | AWS access key |
| `AIza*` | Google API key |
| `eyJ*` | JWT tokens |
| `-----BEGIN PRIVATE KEY-----` | Private keys |

**Smart whitelist**: Lines containing `test`, `example`, `TODO`, `placeholder`, etc. are skipped. `.env` files are always allowed.

**User override**: When blocked, Claude Code shows the warning. You can choose to proceed.

### Branch Protection

**PreToolUse** on `git push` — blocks pushes to protected branches.

- Default protected: `main`, `master`
- Detects force push attempts
- Parses push target from command arguments (not just current branch)
- Configurable via `/opencraft:setup`

### Dependency Change Audit

**PostToolUse** on Write/Edit — non-blocking warning when dependency files change.

Monitors: `package.json`, `go.mod`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `pubspec.yaml`, and more.

Excludes: `node_modules/`, `vendor/`, `.cache/`, `dist/`, `build/`

### Architecture Guard

**PostToolUse** on Write/Edit — when a source file is modified, warns about files that depend on it. Two-tier resolution: codegraph MCP (AST-precise) → grep (regex fallback). Non-blocking warning.

### CI Alignment

**SessionStart** — compares commands in `.github/workflows/*.yml` against your governance profile. Reports mismatches so local verification matches CI.

### Convention Discovery

**SessionStart** — auto-scans your codebase to detect naming conventions, structure patterns, and common libraries. Results saved to `.opencraft/conventions.md` (human-readable) and `.opencraft/conventions.json` (machine cache).

Scanners:
- **Naming** — function/variable/file naming styles (camelCase, snake_case, etc.)
- **Structure** — average function length, test directory, source directory
- **Patterns** — error handling, state management, testing frameworks
- **Imports** — path aliases, import styles, barrel exports

Override detected conventions via `.opencraft/overrides.yaml`.

### Decision Continuity

**SessionStart** — reads historical decisions from cccmemory and injects them as context. Ensures AI doesn't re-debate settled architecture choices.

### Quality Baseline

**SessionStart** — tracks code quality metrics across sessions:
- Function length (avg, P75, P90)
- File length (avg, max)
- TODO/FIXME/HACK count
- Test ratio
- Duplicate code blocks
- Anti-patterns (large files, god modules)

Trends are shown when significant (>5% change). Snapshots saved to `.opencraft/quality-snapshot.json`.

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
| `build.gradle.kts` | Kotlin | `./gradlew test` |
| `Gemfile` | Ruby | `bundle exec rspec` |
| `composer.json` | PHP | `phpunit` |
| `*.csproj` / `*.sln` | .NET | `dotnet test` |
| `Package.swift` | Swift | `swift test` |
| `mix.exs` | Elixir | `mix test` |
| `pubspec.yaml` | Dart/Flutter | `flutter test` |

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
| `opencraft:learn` | Scan conventions, review findings, persist as knowledge or rules |
| `opencraft:context` | Pull full project context on demand |
| `opencraft:knowledge` | Browse and manage knowledge scope (project/global) |
| `opencraft:refresh` | Hot-update the governance profile in-session |
| `opencraft:wrap` | Extract preferences/patterns from session, write to knowledge |

Most of the time, you won't need these — governance works automatically through hooks.

## Storage

All opencraft generated files live in `.opencraft/`:

| File | Purpose |
|------|---------|
| `.opencraft/profile.json` | Auto-generated governance profile |
| `.opencraft/conventions.md` | Discovered coding conventions |
| `.opencraft/quality-snapshot.json` | Code quality metrics history |
| `.opencraft/knowledge.md` | Project knowledge (cccmemory fallback) |

Add `.opencraft/` to your `.gitignore` to exclude generated files from version control.

## Hooks

| Hook | Event | What It Does |
|------|-------|-------------|
| `session-start.cjs` | SessionStart | Detects tech stack, generates profile, checks CI alignment, runs smart context |
| `pre-tool-use.cjs` | PreToolUse | Secret scanning on Write/Edit, branch protection on git push |
| `post-tool-use.cjs` | PostToolUse | Dependency audit, architecture guard, verification on git push |

## Visibility

Opencraft follows a three-level visibility strategy:

- **Silent (Level 0)** — Verification passes: no output
- **Info (Level 1)** — Status summary at session start: `[opencraft] ✅ Go | 2 changes | 42-line CLAUDE.md`
- **Blocking (Level 2)** — Verification failure or secret detection: error details + action blocked

## Compatible Plugins

| Plugin | Focus | Compatible? |
|--------|-------|------------|
| [Superpowers](https://github.com/anthropics/claude-plugins-official) | TDD, debugging, code review | Yes — complementary |
| [OpenSpec](https://github.com/fission-ai/openspec) | Change management, structured workflows | Yes — opencraft reads active changes for context |

No conflicts — opencraft uses `<opencraft-context>` tags that don't interfere with other plugins.

## Project-Level Hooks

Templates for project-specific guards are in `templates/project-hooks/`:

- `deploy-safety-guard.js` — Pre-deploy checks (tsc, vitest, vite build, wrangler config)
- `submodule-push-guard.js` — Ensures submodules are committed and pushed first

## License

MIT
