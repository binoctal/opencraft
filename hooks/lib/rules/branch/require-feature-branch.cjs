module.exports = [
  {
    id: "require-feature-branch",
    name: "Require Feature Branch",
    type: "branch",
    severity: "high",
    check: (ctx) => {
      const cmd = ctx.input?.tool_input?.command || "";
      if (!/git\s+push/.test(cmd)) return { blocked: false };
      try {
        const { execSync } = require("child_process");
        const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ctx.cwd, timeout: 3000 }).toString().trim();
        if (branch === "main" || branch === "master") {
          return { blocked: false, message: `[opencraft] ⚠ pushing from '${branch}'. Consider using a feature branch.` };
        }
      } catch {}
      return { blocked: false };
    },
  },
];
