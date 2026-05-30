---
name: verify
description: Run project verification commands from the governance profile
---

Run the verification commands configured in `.claude/opencraft-profile.json`.

## Steps

1. **Load profile**
   - Read `.claude/opencraft-profile.json`
   - If not found, report "No governance profile found. Start a new session to auto-generate one." and stop.

2. **Display what will run**
   - Show tech stack detected
   - List verify commands that will be executed
   - List lint commands if any

3. **Execute verify commands**
   - Run each command from `profile.verify` sequentially
   - Report pass/fail for each
   - If a command is not found on the system, skip it with a note

4. **Execute lint commands** (if any)
   - Run each command from `profile.lint` sequentially
   - Report results

5. **Show summary**
   - Total commands run, passed, failed, skipped
   - If all passed: confirmation message
   - If any failed: list failures with details and suggested fixes

## Guardrails

- Do not run build commands (those are for CI, not verification)
- Skip commands that don't exist on the system (don't treat as failure)
- Use reasonable timeouts (60s per command by default)
