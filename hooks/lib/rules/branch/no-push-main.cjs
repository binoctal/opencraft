const path = require("path");
const fs = require("fs");

module.exports = [
  {
    id: "no-push-main",
    name: "Block Push to Main",
    type: "branch",
    severity: "critical",
    check: (ctx) => {
      const cmd = ctx.input?.tool_input?.command || "";
      if (!/git\s+push/.test(cmd)) return { blocked: false };
      if (/--dry-run/.test(cmd)) return { blocked: false };

      const cwd = ctx.cwd;
      const stripped = cmd.replace(/git\s+push/, "").replace(/--\S+/g, "").trim();
      const parts = stripped.split(/\s+/).filter(Boolean);
      let target = "";
      for (const part of parts) {
        if (part === "origin" || part.includes(".")) continue;
        if (part.includes(":")) { target = part.split(":").pop(); break; }
        if (/^[a-zA-Z0-9._\/-]+$/.test(part)) { target = part; break; }
      }
      if (!target) {
        try {
          const { execSync } = require("child_process");
          target = execSync("git rev-parse --abbrev-ref HEAD", { cwd, timeout: 3000 }).toString().trim();
        } catch { return { blocked: false }; }
      }

      const profilePath = path.join(cwd, ".opencraft", "profile.json");
      let protected_ = ["main", "master"];
      try {
        const profile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
        if (profile.protectedBranches) protected_ = profile.protectedBranches;
      } catch {}

      // Normalize refs/heads/ prefix
      const shortRef = target.includes("/") ? target.split("/").pop() : target;
      if (protected_.includes(shortRef) || protected_.includes(target)) {
        return { blocked: true, message: `[opencraft] push to '${target}' blocked. Use a feature branch.` };
      }
      return { blocked: false };
    },
  },
];
