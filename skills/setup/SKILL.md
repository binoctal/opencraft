---
name: setup
description: View and adjust the auto-generated governance profile (opencraft-profile.json)
---

View or adjust opencraft's auto-generated governance configuration.

## Steps

1. **Show current profile**
   - Read `.claude/opencraft-profile.json`
   - Display: tech stack, verification commands, lint commands, build commands, detection date
   - If profile doesn't exist, explain that it will be auto-generated on next session start

2. **Offer adjustments**
   - Ask what the user wants to change:
     - Add/remove verification commands
     - Change lint configuration
     - Add custom build commands
     - Force re-detection of tech stack

3. **Apply changes**
   - Update `.claude/opencraft-profile.json` with the user's modifications
   - Preserve `detectedBy: "opencraft-auto"` for auto-detected fields, or set `"opencraft-manual"` for user overrides
   - Show the updated profile

4. **Show status**
   - Current CLAUDE.md line count and health
   - Active adapters detected (openspec, git)
   - Summary of what changed

## Guardrails

- Only modify `.claude/opencraft-profile.json`, never touch other config files
- Preserve the `files` fingerprint field unless user explicitly requests re-detection
- Warn if manual changes might be overwritten on next auto-detection (if tech stack changes)
