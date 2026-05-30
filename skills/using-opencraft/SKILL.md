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
2. **Profile generation**: Generates `.claude/opencraft-profile.json` with appropriate verify/lint/build commands
3. **Automatic enforcement**: PostToolUse hook runs verification after every `git commit`; Stop hook checks for unverified changes

## Available Skills

| Skill | When to Use |
|-------|-------------|
| `opencraft:setup` | View or adjust the auto-generated governance profile |
| `opencraft:verify` | Manually run verification commands from the profile |
| `opencraft:onboard` | Guided walkthrough of governance concepts |

## Governance Rules

These rules are enforced automatically:

- Verification commands run after every `git commit` (PostToolUse hook)
- Uncommitted changes are flagged when a session ends (Stop hook)
- CLAUDE.md should stay under 80 lines
- Tech stack changes trigger automatic profile refresh

## Compatibility

Opencraft works alongside other plugins:
- **superpowers**: Complementary — opencraft injects project facts, superpowers injects behavioral instructions
- **openspec**: Optional — when present, opencraft reads active changes for context
- No external dependencies required

## Instruction Priority

1. **User's explicit instructions** (CLAUDE.md, direct requests) — highest priority
2. **Opencraft governance** — automatic quality enforcement
3. **Default system behavior** — lowest priority
