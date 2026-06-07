---
name: context
description: Call this when you need project conventions, tech stack details, recent decisions, or working tree status
---

Pull and display the full project context for the current opencraft-activated project.

## Instructions

1. **Run smart context builder** — Execute the following to gather all context:

```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { buildSmartContext } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/smart-context.cjs');
const cwd = process.cwd();
const result = buildSmartContext(cwd, { budget: 2000 });
process.stdout.write(result.context);
"
```

2. **Format and present** — Display the context to the user in a structured way:
   - Show each section (Tech Stack, Conventions, Decisions, Working Tree, etc.)
   - Highlight any warnings or actions (e.g., CI misalignment, stale conventions)
   - Keep the output readable — not raw JSON

3. **Suggest actions** — Based on what the context reveals:
   - Many new uncommitted files? Suggest a commit
   - Stale conventions? Suggest `/opencraft:learn`
   - CI misalignment? Suggest updating verify commands via `/opencraft:setup`

## Notes
- This skill replaces the old session-start context dump (v2.x)
- Uses 2000 token budget (vs old 800) because it's on-demand, not permanent
- If the command fails, tell the user to run `/opencraft:setup` first
