# Changelog

## v3.1.0

### Added
- **Knowledge scope management**: browse, promote, demote, delete, edit knowledge entries across project and global scope
- **`opencraft:knowledge` skill**: interactive knowledge browser with scope operations
- **Knowledge module extensions** (`hooks/lib/knowledge.cjs`): `readAll`, `promote`, `demote`, `deleteEntry`, `editEntry`
- Global knowledge file (`~/.opencraft/knowledge.md`) for cross-project sharing without cccmemory

### Tests
- Added 10 new tests for scope operations in `test/knowledge.test.cjs`

## v3.0.0

### Breaking Changes
- **Push→Pull context**: session-start no longer injects 800 tokens of context. Outputs ~50 token index line instead.
- Use `opencraft:context` skill to pull full project details on demand.

### Added
- **Knowledge module** (`hooks/lib/knowledge.cjs`): cccmemory-aware storage with `.opencraft/knowledge.md` fallback
- **`opencraft:context` skill**: pull full project context (tech stack, conventions, decisions, working tree) on demand
- **`opencraft:learn` skill**: scan conventions, review findings, persist as knowledge or convert to enforceable rules
- **`opencraft:wrap` enhancement**: extracts preferences/patterns from session, writes to cccmemory or knowledge file, proactively suggests `/opencraft:learn`
- **`opencraft:setup` enhancement**: suggests `/opencraft:learn` after activation
- Convention→rule auto-generation: user-confirmed conventions generate `.opencraft/rules/` files loaded by Phase A rule engine

### Changed
- `session-start.cjs`: 800 token push → ~50 token index line
- `skills/wrap/SKILL.md`: added preference/pattern extraction, knowledge writing, proactive suggestions
- `skills/setup/SKILL.md`: added learn suggestion
- `skills/using-opencraft/SKILL.md`: updated for v3.0.0 skills table and context system

### Tests
- Added `test/knowledge.test.cjs` — knowledge module tests
- Added `test/session-start.test.cjs` — index line builder tests

## v2.0.0

### Breaking Changes
- **Rule engine architecture**: all governance logic moved to declarative rule files
- `secret-patterns.cjs` removed; replaced by `hooks/lib/rules/secrets/*.cjs` (20 files, ~40 rules)
- `pre-tool-use.cjs` and `post-tool-use.cjs` rewritten as thin dispatchers (151+184 → 44+34 lines)

### Added
- Universal rule engine (`hooks/lib/rule-engine.cjs`) with Shannon entropy, keyword pre-filter, multiline support, three-level allowlist
- ~40 curated secret rules ported from gitleaks: AWS, GCP, Azure, Cloudflare, GitHub (5), GitLab (3), Stripe, Anthropic (2), OpenAI (2), Slack (4), Twilio, SendGrid, NPM, Datadog, Sentry, database URIs (4), private keys, JWT, PyPI, generic API keys
- Branch protection rules (no-push-main, no-force-push, require-feature-branch)
- Commit rules (version-bump, version-consistency)
- Dependency audit rules (deps-changed, architecture-impact)
- Quality rule (smart-verify before push)
- User custom rules via `.opencraft/rules/` directory (override built-in by id)
- Error handling: rule failures never block user operations

### Changed
- `pre-tool-use.cjs`: 151 → 44 lines (thin dispatcher)
- `post-tool-use.cjs`: 184 → 34 lines (thin dispatcher)

### Tests
- 278 tests, 0 failures (21 old secret-patterns tests replaced by 61 new rule tests)

## v1.0.1

### Added
- **Stop Hook: Decision Auto-Append** — detects decision keywords in conversation and appends to `.opencraft/decisions.md`
  - `hooks/stop.cjs` — scans assistant responses for decision signals (Chinese + English)
  - Keywords: 选择了, 采用, 决定使用, chose to use, decided on, going with, etc.
  - Deduplication by text prefix, 50KB file cap, max 5 decisions per invocation
  - Registered in `hooks/hooks.json` under Stop event

### Changed
- **Architecture Guard: trivial filename filter** — `hooks/lib/deps-resolve.cjs`
  - Added TRIVIAL_FILES set: index, types, utils, helpers, config, constants, enums, interfaces, mod, lib
  - Grep results filtered to exclude false positives from re-export files

### Tests
- Added `test/stop-hook.test.cjs` — 14 tests for decision detection, topic extraction, file append, dedup, size cap
- Added trivial file filter tests to `test/deps-resolve.test.cjs` — 3 tests
- Full suite now 231 tests, zero failures

## v1.0.0

### Added
- **Quality Baseline**: track code quality metrics across sessions
  - `hooks/lib/quality-snapshot.cjs` — collect metrics: function length, file length, TODOs, test ratio, duplicates, anti-patterns
  - Trend detection: compare current metrics to previous snapshot
  - Anti-pattern detection: large files (>400 lines), god modules (>10 exports), long functions
  - Snapshot saved to `.opencraft/quality-snapshot.json`
  - `hooks/lib/collectors/quality-snapshot.cjs` — smart context collector for quality trends

### Changed
- Smart context now includes 10 collectors (+ quality-snapshot)
- Quality trends shown in session-start when significant (>5% change)

### Tests
- Added `test/quality-snapshot.test.cjs` — 24 tests for metrics collection, trend detection, anti-patterns
- Full suite now 214 tests, zero failures

### Release Notes
v1.0.0 combines all governance capabilities:
- Convention Discovery (v0.7.0) — auto-scan naming, structure, patterns, imports
- Decision Continuity + Smart Context (v0.8.0) — priority-based signal system
- Architecture Guard (v0.9.0) — dependency impact warnings
- Quality Baseline (v1.0.0) — track code quality trends
- Plus existing: secret scanning, branch protection, tech stack detection, CI alignment

## v0.9.0

### Added
- **Architecture Guard**: dependency impact check on Write/Edit (PostToolUse)
  - `hooks/lib/deps-resolve.cjs` — two-tier resolution: codegraph → grep
  - Warns when modified file has dependents (non-blocking)
  - Grep patterns cover CommonJS `require()`, ES modules `import`, Python, Go
  - Excludes node_modules, vendor, dist, build, .git, .cache, learning, docs
  - Max 10 dependents shown, formatted with file list

### Changed
- `hooks/post-tool-use.cjs` — integrated dependency impact check alongside dependency file audit

### Tests
- Added `test/deps-resolve.test.cjs` — 13 tests for escapeRegex, grepImportPaths, getDependents, formatWarning
- Full suite now 190 tests, zero failures

## v0.8.0

### Added
- **Decision Continuity**: reads historical decisions from cccmemory SQLite database
  - `hooks/lib/collectors/decisions.cjs` collector with Python SQLite helper
  - Falls back to `.opencraft/decisions.md` when cccmemory unavailable
  - Groups by topic, formats with date for context injection
- **Smart Context**: priority-based signal system with token budget management
  - `hooks/lib/smart-context.cjs` coordinator module
  - Signal structure: `{id, section, priority, tokens, content, action}`
  - Priority tiers: 90-100 (block), 70-89 (action), 50-69 (context), 30-49 (info), 10-29 (hint)
  - Default 800 token budget with greedy selection
  - 9 collectors in `hooks/lib/collectors/`:
    - `tech-stack.cjs` — tech stack + verify commands
    - `working-tree.cjs` — uncommitted files
    - `recent-activity.cjs` — recent commits + branch
    - `open-work.cjs` — unmerged branches, TODOs, stash
    - `conventions.cjs` — discovered conventions
    - `decisions.cjs` — historical decisions from cccmemory
    - `openspec.cjs` — OpenSpec task progress
    - `ci-alignment.cjs` — CI command mismatches (priority 90)
    - `claude-md.cjs` — CLAUDE.md line count check

### Changed
- `hooks/session-start.cjs` refactored to use `buildSmartContext()` instead of monolithic `buildContext()`
- Removed inline context building in favor of collector-based approach

### Tests
- Added `test/decisions.test.cjs` — 9 tests for decisions collector
- Added `test/smart-context.test.cjs` — 16 tests for signal system
- Full suite now 177 tests, zero failures

## v0.7.0

### Added
- Convention Discovery Engine: auto-scan codebase to extract naming, structure, pattern, and import conventions
- 4 regex-based scanners: naming, structure, patterns, imports (~80% accuracy, Phase 1)
- `hooks/lib/convention-engine.cjs` coordinator with git-hash caching (skip scan on unchanged commits)
- Conventions injected into session-start context as compact Chinese summary
- Convention count shown in status message line
- Output saved to `.opencraft/conventions.md` (human-readable) + `.opencraft/conventions.json` (machine cache)
- 52 new tests across 5 test files (scan-utils, naming, structure, patterns, imports, convention-engine)
- Full suite now 149 tests, zero failures

## v0.6.0

### Added
- Test suite with 88 tests across 6 modules (node:test, zero dependencies)
- Session-start enriches context with git intel, TODO scan, and OpenSpec progress
- CLAUDE.md auto-governance: signals when exceeding 80-line limit
- Smart verify reminder: suggests running tests when 5+ code files changed

### Changed
- Git adapter always loads (not just as fallback when no other adapter found)
- Post-tool-use outputs dependency change warnings and verify reminders

### Removed
- Dead `scripts/session-end-summarize.cjs` (hook unregistered, no references)

## v0.5.5

### Changed
- Replaced custom handoff mechanism with cccmemory for session continuity

## v0.5.4

### Added
- `opencraft:refresh` skill for in-session profile hot-update

## v0.5.3

### Changed
- Enforce version bump on commit via pre-tool-use hook
