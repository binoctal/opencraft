---
name: knowledge
description: Browse all project and global knowledge — promote, demote, delete, or edit entries
---

Browse and manage knowledge across project and global scope.

## Step 1: List All Knowledge

```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { hasCccmemory, readAll } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/knowledge.cjs');
const cwd = process.cwd();
const hasDb = hasCccmemory();
console.log('cccmemory:', hasDb ? 'available' : 'not available');
console.log('');
const entries = readAll(cwd);
if (entries.length === 0) {
  console.log('No knowledge entries found.');
  console.log('Run /opencraft:learn to scan and persist project conventions.');
} else {
  const project = entries.filter(e => e.scope === 'project');
  const global = entries.filter(e => e.scope === 'global');
  if (project.length > 0) {
    console.log('## Project Knowledge (this project)');
    project.forEach((e, i) => {
      const tag = e.type === 'preferences' ? 'pref' : e.type === 'patterns' ? 'patn' : e.type === 'decisions' ? 'dec' : 'got';
      console.log('  ' + (i + 1) + '. [' + tag + '] ' + e.key + ' — ' + e.value);
    });
    console.log('');
  }
  if (global.length > 0) {
    console.log('## Global Knowledge (all projects)');
    global.forEach((e, i) => {
      const tag = e.type === 'preferences' ? 'pref' : e.type === 'patterns' ? 'patn' : e.type === 'decisions' ? 'dec' : 'got';
      const num = project.length + i + 1;
      console.log('  ' + num + '. [' + tag + '] ' + e.key + ' — ' + e.value);
    });
    console.log('');
  }
  console.log('Actions: promote N | demote N | delete N | edit N | export N');
}
"
```

If cccmemory is available, also use `mcp__cccmemory__search_memory_by_quality` with `scope: "global"` and `scope: "project"` to cross-reference.

## Step 2: User Selects Action

The user says one of:
- `promote N` — move entry N from project to global
- `demote N` — move entry N from global to project
- `delete N` — remove entry N
- `edit N` — Claude asks for new value, then updates
- `export N` — convert entry N to an enforce rule in `.opencraft/rules/`

Parse the number N against the displayed list.

## Step 3: Execute

For each action, determine the entry's key and scope from the list, then:

**promote N:**
- If cccmemory: `mcp__cccmemory__remember` with same content + `scope: "global"`, then `mcp__cccmemory__forget` from project
- If no cccmemory:
```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { promote } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/knowledge.cjs');
promote(process.cwd(), undefined, '${key}');
console.log('Promoted: ${key} → global');
"
```

**demote N:**
- If cccmemory: `mcp__cccmemory__remember` with same content + `scope: "project"`, then `mcp__cccmemory__forget` from global
- If no cccmemory:
```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { demote } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/knowledge.cjs');
demote(process.cwd(), undefined, '${key}');
console.log('Demoted: ${key} → project');
"
```

**delete N:**
- If cccmemory: `mcp__cccmemory__forget` with the entry's key
- If no cccmemory:
```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { deleteEntry } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/knowledge.cjs');
deleteEntry(process.cwd(), undefined, '${key}', '${scope}');
console.log('Deleted: ${key}');
"
```

**edit N:**
- Ask the user: "What should the new value be?"
- If cccmemory: `mcp__cccmemory__remember` with same key + new value
- If no cccmemory:
```bash
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(node -e "const p=require('path'),f=require('fs'),h=require('os').homedir(),d=p.join(h,'.claude/plugins/cache/opencraft/opencraft');try{const v=f.readdirSync(d).sort().pop();const c=p.join(d,v);if(f.existsSync(p.join(c,'hooks/lib/knowledge.cjs'))){process.stdout.write(c);process.exit(0)}}catch{}process.exit(1)")}"
node -e "
const { editEntry } = require(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/lib/knowledge.cjs');
editEntry(process.cwd(), undefined, '${key}', '${scope}', '${newValue}');
console.log('Updated: ${key}');
"
```

**export N:**
1. Read the entry's key and value
2. Generate a rule file following this structure:
```js
module.exports = [{
  id: "knowledge-<key>",
  name: "<Human-readable name from value>",
  type: "quality",
  severity: "medium",
  trigger: "Write|Edit",
  check: (ctx) => {
    // Detection logic derived from the knowledge value
    // Return { blocked: false, message: "warning text" } for violations
  },
}];
```
3. Show the generated rule to the user for review
4. If approved, write to `.opencraft/rules/knowledge-<key>.cjs`
5. The Phase A rule engine auto-loads it on next hook invocation

## Step 4: Re-list and Repeat

After each action, re-run the listing from Step 1 to show the updated state. Repeat from Step 2.
