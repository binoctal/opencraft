module.exports = [
  {
    id: "version-bump",
    name: "Version Bump Required",
    type: "commit",
    severity: "high",
    check: (ctx) => {
      const cmd = ctx.input?.tool_input?.command || "";
      if (!/git\s+commit/.test(cmd)) return { blocked: false };
      if (/--amend/.test(cmd)) return { blocked: false };
      const cwd = ctx.cwd;
      const fs = require("fs");
      const path = require("path");
      const pkgPath = path.join(cwd, "package.json");
      if (!fs.existsSync(pkgPath)) return { blocked: false };
      const { execSync } = require("child_process");
      const staged = (() => { try { return execSync("git show :package.json", { cwd, timeout: 3000 }).toString(); } catch { return ""; } })();
      if (!staged) return { blocked: false };
      let stagedVersion;
      try { stagedVersion = JSON.parse(staged).version; } catch { return { blocked: false }; }
      const head = (() => { try { return execSync("git show HEAD:package.json", { cwd, timeout: 3000 }).toString(); } catch { return ""; } })();
      if (!head) return { blocked: false };
      let headVersion;
      try { headVersion = JSON.parse(head).version; } catch { return { blocked: false }; }
      if (stagedVersion === headVersion) {
        return { blocked: true, message: `[opencraft] version not bumped (still ${headVersion}). Update version before committing.` };
      }
      return { blocked: false };
    },
  },
];
