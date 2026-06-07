# Changelog

## v0.1.0

Initial public release with full governance feature set:

### Core
- Tech stack auto-detection (14 languages, 5 monorepo tools)
- Governance profile generation (`.opencraft/profile.json`)
- Session handoff (AI-generated summaries)
- CI alignment checks

### Security
- Secret leak prevention (~40 rules from gitleaks patterns)
- Branch protection (main/master, force push detection)
- Commit rules (version bump, consistency)

### Intelligence
- Convention discovery (naming, structure, patterns, imports)
- Decision continuity (cccmemory + file fallback)
- Architecture guard (dependency impact warnings)
- Quality baseline (metrics tracking with trend detection)
- Smart context (10 priority-based collectors)

### Knowledge
- Knowledge scope management (project/global)
- Convention→rule auto-generation

### Skills
- `opencraft:setup` — governance profile management
- `opencraft:verify` — manual verification
- `opencraft:onboard` — guided walkthrough
- `opencraft:learn` — convention scanning
- `opencraft:context` — on-demand project context
- `opencraft:knowledge` — knowledge browser
- `opencraft:refresh` — profile hot-update
- `opencraft:wrap` — session preference extraction

### Tests
- 278 tests, 0 failures, 0 dependencies
