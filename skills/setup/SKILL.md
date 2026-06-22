---
name: setup
description: Activate opencraft for this project, or view/adjust the governance profile
---

Activate opencraft governance for the current project, or adjust an existing configuration.

## Activation

If `.opencraft/profile.json` does NOT exist (project not yet activated):

1. **Run detection**
   - Scan project for tech stack fingerprints (go.mod, tsconfig.json, package.json, etc.)
   - Detect monorepo setup, test frameworks, lint tools
   - Generate `.opencraft/profile.json` with verification commands
   - Plugin is automatically enabled for this project (detection.cjs injects `enabledPlugins` into `.claude/settings.json`)

2. **Run convention scan**
   - Scan naming conventions (camelCase, snake_case, etc.)
   - Detect structure patterns (function length, test directory)
   - Save to `.opencraft/conventions.md` + `.opencraft/conventions.json`

3. **Seed global disabled-rules config**
   - Run `node hooks/lib/ensure-global-config.cjs` (or require + call `ensureGlobalDisabledRules()`)
   - Creates `~/.opencraft/disabled-rules.json` from the shipped default template on first run only; never overwrites an existing user-edited file
   - This is what makes branch-protection rules (no-push-main, etc.) disabled by default

4. **Show results**
   - Display: detected tech stack, verification commands, conventions found
   - Explain what opencraft will now do automatically (session context, secret scanning, dependency audit, etc.)

5. **Gitignore**
   - Remind user to add `.opencraft/` to `.gitignore` if not already present

## Adjustment

If `.opencraft/profile.json` already exists:

1. **Show current profile**
   - Display: tech stack, verification commands, lint commands, build commands, detection date

2. **Offer adjustments**
   - Add/remove verification commands
   - Change lint configuration
   - Force re-detection of tech stack

3. **Apply changes**
   - Update `.opencraft/profile.json`
   - Set `"opencraft-manual"` for user-overridden fields

## Status

After activation or adjustment:
- CLAUDE.md line count
- Active adapters (openspec, git)
- Convention count
- What hooks are now active

## Next Step

After activation, suggest:

"Setup complete! Want me to learn your project conventions? Run `/opencraft:learn` to scan and persist your coding patterns."

## Guardrails

- Only modify `.opencraft/profile.json`
- Preserve `files` fingerprint unless user requests re-detection
- Warn if manual changes might be overwritten on next auto-detection
