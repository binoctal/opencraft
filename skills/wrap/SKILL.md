---
name: wrap
description: Wrap up the session — extract preferences and patterns, update cccmemory or knowledge file, suggest next steps
---

Wrap up the current session by extracting and persisting what was learned.

## Steps

### 1. Session Summary

Reflect on what happened this session:
- What was worked on?
- Key decisions made (with rationale)?
- Unfinished tasks or blockers?
- Any mistakes made or corrected?

### 2. Preference & Pattern Extraction

Review the conversation for:

**Preferences** — user corrections like "no, do it this way", "I prefer X", "don't use Y":
- What preference was expressed?
- Was it a one-time choice or a recurring preference?

**Patterns** — repeated approaches across the session:
- Same technique used 3+ times?
- Same library or pattern chosen consistently?

**Gotchas** — mistakes or surprises:
- What went wrong?
- What was the fix?

### 3. Write Knowledge

For each finding worth persisting:

**If cccmemory is available** (check with `mcp__cccmemory__get_health_report` or try calling a cccmemory tool):
- Decisions → `mcp__cccmemory__remember` with `tags: ["decision"]`
- Preferences → `mcp__cccmemory__remember` with `tags: ["preference"]`
- Mistakes → `mcp__cccmemory__remember` with `tags: ["mistake"]`
- Patterns → `mcp__cccmemory__remember` with `tags: ["pattern"]`

**If no cccmemory**, write to file:

```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { writeKnowledgeFile } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/knowledge.cjs');
writeKnowledgeFile(process.cwd(), { type: '${type}', key: '${key}', value: '${value}' });
"
```

Run one command per entry.

### 4. Update OpenWolf Files (if `.wolf/` exists)

- Append session summary to `.wolf/memory.md`
- Update `.wolf/cerebrum.md` if user preferences, conventions, or gotchas were learned
- Log any bugs fixed to `.wolf/buglog.json`

### 5. Proactive Suggestions

If any new patterns or preferences were found this session, output:

```
📚 Found N new patterns/preferences this session.
Run /opencraft:learn to review and persist them as project knowledge or rules.
```

If this is a first wrap for this project, suggest:

```
💡 This is your first session wrap. Run /opencraft:learn to do a full convention scan.
```

### 6. Confirm

Say: "Session wrapped. You can now type `/exit` to end."
