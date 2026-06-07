const path = require("path");
const EXCLUDED_DIRS = /(^|\/)(node_modules|vendor|\.cache|dist|build)\//;

module.exports = [
  {
    id: "architecture-impact",
    name: "Architecture Impact Check",
    type: "deps",
    severity: "medium",
    check: (ctx) => {
      const filePath = ctx.input?.tool_input?.file_path || "";
      if (!filePath || EXCLUDED_DIRS.test(filePath)) return { blocked: false };
      try {
        const { getDependents, formatWarning } = require("../../deps-resolve.cjs");
        const result = getDependents(ctx.cwd, filePath);
        const warning = formatWarning(filePath, result);
        if (warning) return { blocked: false, message: warning };
      } catch {}
      return { blocked: false };
    },
  },
];
