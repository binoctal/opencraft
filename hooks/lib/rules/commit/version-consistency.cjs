module.exports = [
  {
    id: "version-consistency",
    name: "Version Consistency Check",
    type: "commit",
    severity: "high",
    check: (ctx) => {
      const cmd = ctx.input?.tool_input?.command || "";
      if (!/git\s+commit/.test(cmd)) return { blocked: false };
      if (/--amend/.test(cmd)) return { blocked: false };
      const cwd = ctx.cwd;
      const fs = require("fs");
      const path = require("path");
      let entries;
      try { entries = fs.readdirSync(cwd).filter(f => f.endsWith(".json")); } catch { return { blocked: false }; }
      const versions = {};
      for (const file of entries) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(cwd, file), "utf-8"));
          if (content.version) versions[file] = content.version;
        } catch {}
      }
      const versionValues = [...new Set(Object.values(versions))];
      if (versionValues.length > 1) {
        const detail = Object.entries(versions).map(([f, v]) => `  ${f}: ${v}`).join("\n");
        return { blocked: true, message: `[opencraft] version mismatch across files:\n${detail}` };
      }
      return { blocked: false };
    },
  },
];
