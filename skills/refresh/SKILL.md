---
name: refresh
description: Force-refresh governance profile and settings to match current plugin version
---

Refresh the opencraft governance profile to match the latest installed plugin version.

## Steps

1. **Regenerate profile**
   Run: `node -e "const d=require('${HOME}/.claude/plugins/marketplaces/opencraft/hooks/lib/detection.cjs'); const p=d.getOrCreateProfile(process.cwd()); console.log(JSON.stringify(p.profile,null,2));"`

2. **Sync settings env**
   Run: `node -e "const d=require('${HOME}/.claude/plugins/marketplaces/opencraft/hooks/lib/detection.cjs'); const fs=require('fs'); const path=require('path'); const sp=path.join(process.cwd(),'.claude','settings.json'); let s={}; try{s=JSON.parse(fs.readFileSync(sp,'utf-8'));}catch{}; if(!s.env)s.env={}; const needed={'CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS':'60000'}; let c=false; for(const[k,v]of Object.entries(needed)){if(!s.env[k]){s.env[k]=v;c=true;}}; if(c){fs.writeFileSync(sp,JSON.stringify(s,null,2)+'\n');console.log('settings env updated');}else{console.log('settings env already configured');}"`

3. **Show result**
   Display the updated profile: tech stack, verify commands, version. Confirm settings env is configured.
