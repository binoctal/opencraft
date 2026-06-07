module.exports = [
  {
    id: "smart-verify",
    name: "Smart Verify Before Push",
    type: "quality",
    severity: "high",
    check: (ctx) => {
      const cmd = ctx.input?.tool_input?.command || "";
      if (!/git\s+push/.test(cmd)) return { blocked: false };
      const fs = require("fs");
      const path = require("path");
      const cwd = ctx.cwd;
      let profile;
      try { profile = JSON.parse(fs.readFileSync(path.join(cwd, ".opencraft", "profile.json"), "utf-8")); } catch { return { blocked: false }; }
      if (!profile.verify || profile.verify.length === 0) return { blocked: false };
      const codeExtensions = /\.(ts|tsx|js|jsx|py|go|rs|rb|java|c|cpp|h|cs|swift|kt)$/i;
      const { execSync } = require("child_process");
      let diffFiles;
      try { diffFiles = execSync("git diff --name-only HEAD", { cwd, timeout: 3000 }).toString(); } catch { return { blocked: false }; }
      const codeFiles = diffFiles.split("\n").filter(f => codeExtensions.test(f));
      if (codeFiles.length >= 5) {
        return { blocked: false, message: `[opencraft] ${codeFiles.length} code files changed — consider running \`${profile.verify[0]}\` before push.` };
      }
      return { blocked: false };
    },
  },
];
