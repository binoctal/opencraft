# Opencraft Usage Guide

## Table of Contents

- [How Governance Works](#how-governance-works)
- [First Session](#first-session)
- [Daily Workflow](#daily-workflow)
- [Skill Reference](#skill-reference)
- [Configuration](#configuration)
- [Compatibility](#compatibility)

---

## How Governance Works

Opencraft runs entirely through three hooks — no manual commands needed:

```
Session Start                    Git Commit                    Session End
    │                                │                             │
    ▼                                ▼                             ▼
Detect tech stack ──────► Run verify commands ──────► Check uncommitted
Generate profile            Pass → silent                 Remind if any
Inject context              Fail → block commit
Show status summary
```

Everything is automatic. You don't need to invoke any skills for governance to work.

---

## First Session

When you first install opencraft and start a conversation in a project:

1. **SessionStart hook** scans your project for fingerprint files
2. **Profile generated** at `.claude/opencraft-profile.json`
3. **Status message**: `[opencraft] TypeScript | governance profile generated | /opencraft:setup to adjust`
4. **Context injected** into the conversation — Claude knows your tech stack and verification commands

From this point, every `git commit` triggers automatic verification.

---

## Daily Workflow

### Making commits

```bash
# You code normally. When you commit:
git commit -m "feat: add user auth"

# Behind the scenes:
# 1. PostToolUse hook reads opencraft-profile.json
# 2. Runs verification commands (e.g., tsc --noEmit, go test ./...)
# 3. Passes → commit succeeds (silent)
# 4. Fails → commit rejected with error details
```

### Ending a session

When you end a conversation, the Stop hook checks:
- Are there uncommitted changes? → Reminder to verify
- Are there active OpenSpec changes? → Reminder to update tasks.md

---

## Skill Reference

### `opencraft:setup`

**Purpose**: View or adjust the auto-generated governance profile.

**When to use**: You want to customize verification commands, add lint tools, or force re-detection.

```bash
/opencraft:setup
```

**What it does**:
1. Reads `.claude/opencraft-profile.json`
2. Shows current configuration (tech stack, verify, lint, build commands)
3. Lets you modify any field
4. Saves changes to the profile

**Common uses**:
- Add `golangci-lint run` to lint commands
- Remove a verification command that doesn't apply
- Force re-detection after adding a new tech stack

---

### `opencraft:verify`

**Purpose**: Manually run verification commands from the profile.

**When to use**: You want to verify without committing, or the Stop hook reminded you about unverified changes.

```bash
/opencraft:verify
```

**What it does**:
1. Reads `.claude/opencraft-profile.json`
2. Shows what will run (tech stack + command list)
3. Executes each verify command sequentially
4. Reports pass/fail/skip for each command
5. Shows summary

---

### `opencraft:onboard`

**Purpose**: Guided walkthrough of governance concepts.

**When to use**: First time using opencraft, or want to understand how it works.

```bash
/opencraft:onboard
```

Walks through auto-detection, the three hooks, three-layer rules, and compatibility.

---

### `opencraft:using-opencraft`

**Purpose**: Session bootstrap — loaded automatically at conversation start.

Shows available skills, governance rules, and compatibility info. Informational only, no side effects.

---

## Configuration

### The Governance Profile

`.claude/opencraft-profile.json` is auto-generated and human-editable:

```json
{
  "version": 1,
  "techStack": ["go", "docker"],
  "verify": ["go vet ./...", "go test ./..."],
  "lint": ["golangci-lint run"],
  "build": ["go build ./..."],
  "detectedAt": "2026-05-30",
  "detectedBy": "opencraft-auto",
  "files": {
    "go.mod": true,
    "Dockerfile": true
  }
}
```

- `techStack`: Detected tech stacks
- `verify`: Commands run after every `git commit`
- `lint`: Commands for lint checks
- `build`: Build commands (not auto-run, for reference)
- `files`: Fingerprint file state — used to detect when profile needs refresh

### Profile Refresh

The profile is automatically refreshed when:
- A fingerprint file is added or removed (e.g., you add `tsconfig.json`)
- The profile doesn't exist yet

You can also force a refresh via `/opencraft:setup`.

### Command Discovery

Opencraft discovers verification commands in this priority:

1. **CI workflows** (`.github/workflows/`) — extracts test/lint commands
2. **Makefile** — uses `make test`, `make lint` if targets exist
3. **Built-in defaults** — per-tech-stack defaults (see README)

### Three-Layer Rules

| Layer | Source | Example |
|-------|--------|---------|
| **Layer 1** (auto) | Hook-detected project config | `go vet ./...` from go.mod |
| **Layer 2** (built-in) | Plugin-shipped principles | Verify before claiming done |
| **Layer 3** (user) | `.claude/opencraft-rules.json` | Custom rules (future) |

---

## Compatibility

### With Superpowers

Fully compatible. Opencraft injects project facts via `<opencraft-context>`, superpowers injects behavioral instructions via `<EXTREMELY_IMPORTANT>`. Both coexist without conflict.

### With OpenSpec

Optional. When `openspec/` directory exists, opencraft reads active changes for additional context in session status. Without OpenSpec, opencraft uses git branch info as fallback.

### With other plugins

Opencraft uses unique `<opencraft-context>` tags and `[opencraft]` message prefixes. It does not modify files or interfere with other plugin behaviors.
