---
name: learn
description: Scan project conventions, review what opencraft knows, and let the user confirm which patterns to persist as knowledge or enforce as rules
---

Scan the project and review accumulated knowledge. The user confirms what to keep.

## Step 1: Scan Conventions

Run the convention engine to discover current project patterns:

```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { runScan } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/convention-engine.cjs');
const result = runScan(process.cwd());
if (result && result.result) {
  process.stdout.write(JSON.stringify(result.result, null, 2));
} else {
  process.stdout.write('No conventions detected.');
}
"
```

## Step 2: Check Existing Knowledge

Read what opencraft already knows about this project:

```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { hasCccmemory, readKnowledgeFile } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/knowledge.cjs');
const cwd = process.cwd();
const hasDb = hasCccmemory();
console.log('cccmemory:', hasDb ? 'available' : 'not available');
const types = ['preferences', 'patterns', 'decisions', 'gotchas'];
for (const type of types) {
  const entries = readKnowledgeFile(cwd, type);
  if (entries.length > 0) {
    console.log('\n## ' + type.charAt(0).toUpperCase() + type.slice(1));
    entries.forEach(e => console.log('- ' + e.key + ' (' + e.date + '): ' + e.value));
  }
}
"
```

If cccmemory is available, also check it for project-specific memories:

Use `mcp__cccmemory__recall_relevant` with query "project preferences and conventions" to find any stored knowledge.

## Step 3: Analyze and Present

Compare scanned conventions vs existing knowledge. Present a confirmation list:

```
## Convention Review

### New findings (not yet recorded):
1. [enforce] Functions use camelCase naming
2. [reference] Error handling uses try/catch with typed errors
3. [enforce] All API handlers have zod validation
4. [reference] Testing framework: vitest

### Already known (no change):
- naming: camelCase functions ✓
- structure: tests in __tests__/ ✓

### Which should I persist?
Select items to save as knowledge. Items marked [enforce] can also be converted to automatic rules.
```

## Step 4: User Confirms → Save

For each confirmed item:

**If cccmemory is available:**
- Use `mcp__cccmemory__remember` with:
  - `tags: ["convention", type]` (e.g., ["convention", "pattern"])
  - `confidence: "confirmed"` (user verified)
  - `importance: "normal"`

**If no cccmemory:**

```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { writeKnowledgeFile } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/knowledge.cjs');
writeKnowledgeFile(process.cwd(), { type: '${type}', key: '${key}', value: '${value}' });
"
```

## Step 5: Convention → Rule (for [enforce] items)

For each item the user wants to enforce as a rule:

1. Generate rule code following this structure:
```js
module.exports = [{
  id: "convention-<name>",
  name: "<Human-readable name>",
  type: "quality",
  severity: "medium",
  trigger: "Write|Edit",
  check: (ctx) => {
    // Detection logic here
  },
}];
```

2. Show the generated rule to the user for review
3. If approved, write to `.opencraft/rules/convention-<name>.cjs`
4. The Phase A rule engine will auto-load it on next hook invocation

## Guardrails
- Never auto-save without user confirmation
- Rule generation requires explicit user approval of the code
- If unsure whether something is [enforce] or [reference], default to [reference]
