---
name: using-opencraft
description: Use when starting any conversation - establishes opencraft as a governance middleware that auto-detects tech stacks and enforces quality gates through hooks
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

# Opencraft: Development Governance Middleware

Opencraft is a **zero-configuration governance layer** that works automatically through hooks. It detects your project's tech stack, configures verification commands, and enforces quality gates — all without manual setup.

## How It Works

1. **Auto-detection**: SessionStart hook scans your project for tech stack fingerprints (go.mod, tsconfig.json, pyproject.toml, etc.)
2. **Profile generation**: Generates `.opencraft/profile.json` with appropriate verify/lint/build commands
3. **Automatic enforcement**: PostToolUse hook runs verification after every `git commit`; Stop hook checks for unverified changes

## Available Skills

| Skill | When to Use |
|-------|-------------|
| `opencraft:context` | Pull full project context (tech stack, conventions, decisions, working tree) |
| `opencraft:setup` | View or adjust the auto-generated governance profile |
| `opencraft:learn` | Scan project conventions, confirm which to persist as knowledge or rules |
| `opencraft:verify` | Manually run verification commands from the profile |
| `opencraft:wrap` | End-of-session: extract preferences, update knowledge, suggest next steps |
| `opencraft:onboard` | Guided walkthrough of governance concepts |
| `opencraft:knowledge` | Browse all knowledge, promote/demote/delete/edit entries across project and global scope |

## Governance Rules

These rules are enforced automatically:

- Secret leak prevention blocks writes containing API keys, tokens, private keys (~40 rules from gitleaks)
- Branch protection blocks pushes to `main`/`master`
- Dependency change audit warns on package.json/go.mod/etc. edits
- Smart verify suggests running tests when 5+ code files changed
- User-defined rules in `.opencraft/rules/` are auto-loaded

## Context System

- **Session start** injects a compact index line (~50 tokens)
- **`opencraft:context`** skill provides full details on demand
- **`opencraft:learn`** captures and persists your coding conventions
- **`opencraft:wrap`** extracts session insights and suggests follow-up

## Compatibility

Opencraft works alongside other plugins:
- **superpowers**: Complementary — opencraft injects project facts, superpowers injects behavioral instructions
- **openspec**: Optional — when present, opencraft reads active changes for context
- No external dependencies required

## Instruction Priority

1. **User's explicit instructions** (CLAUDE.md, direct requests) — highest priority
2. **Opencraft governance** — automatic quality enforcement
3. **Default system behavior** — lowest priority
