---
name: onboard
description: Guided walkthrough of opencraft governance concepts for new users
---

Walk the user through opencraft's governance middleware concepts. This is a teaching experience — explain how automatic governance works in their project.

---

## Phase 1: Welcome

```
## Welcome to Opencraft!

Opencraft is a **development governance middleware** — an invisible layer that enforces quality gates and project-specific rules automatically through hooks.

**What makes it different:**
- Zero setup required — detects your tech stack automatically
- Works through hooks, not manual commands — governance happens automatically
- Complements your existing tools — works alongside superpowers and openspec

Let me show you how it works in your project.
```

---

## Phase 2: Show Auto-Detection

Check if a governance profile already exists:

```bash
cat .claude/opencraft-profile.json 2>/dev/null || echo "NO_PROFILE"
```

**If profile exists:**
```
Opencraft already knows your project. Here's what it detected:

- **Tech stack**: [from profile]
- **Verification**: [commands from profile]
- **Detected on**: [date]

These commands run automatically after every `git commit` via the PostToolUse hook.
```

**If no profile:**
```
Let me check what opencraft would detect in your project...
```
Scan for fingerprint files (go.mod, tsconfig.json, pyproject.toml, Cargo.toml, pom.xml, package.json) and explain what would be detected.

---

## Phase 3: Explain the Three Hooks

```
## How Governance Works

Opencraft uses three hooks that run automatically:

### 1. SessionStart (when you start a conversation)
- Detects tech stack from fingerprint files
- Generates/refreshes `.claude/opencraft-profile.json`
- Injects project context into the conversation
- Shows a one-line status summary

### 2. PostToolUse (after every `git commit`)
- Runs verification commands from the profile
- **Passes silently** if everything is fine
- **Blocks the commit** if verification fails, showing error details

### 3. Stop (when you end a conversation)
- Checks for uncommitted changes
- Reminds you if there's unverified work
- Never blocks — just a gentle reminder
```

---

## Phase 4: Three-Layer Rules

```
## Governance Rules Come From Three Layers

### Layer 1: Auto-detected (highest priority)
Your project's tech stack → specific verification commands
Example: `go.mod` detected → `go vet ./...` + `go test ./...`

### Layer 2: Built-in principles
Shipped with the plugin, always active:
- Verify before claiming done
- Commit quality checks run automatically
- CLAUDE.md stays under 80 lines

### Layer 3: User overrides (optional)
Create `.claude/opencraft-rules.json` to customize
```

---

## Phase 5: Available Skills

```
## Skills You Can Use

| Skill | What it does |
|-------|-------------|
| `/opencraft:setup` | View or adjust the governance profile |
| `/opencraft:verify` | Manually run verification commands |
| `/opencraft:onboard` | This walkthrough |

Most of the time, you won't need any of these — governance just works.
```

---

## Phase 6: Compatibility

```
## Works With Your Tools

- **superpowers**: Fully compatible. Opencraft injects project facts, superpowers injects behavioral instructions. Both coexist.
- **openspec**: Optional. When openspec is installed, opencraft reads active changes for additional context.
- **No conflicts**: Opencraft uses `<opencraft-context>` tags, never interfering with other plugins.
```

---

## Guardrails

- Keep it brief — this is a walkthrough, not a lecture
- Use the user's actual project for examples
- If the user already has a profile, use it; if not, show what would be detected
- Handle exits gracefully — never pressure the user
