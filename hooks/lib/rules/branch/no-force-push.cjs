module.exports = [
  {
    id: "no-force-push",
    name: "Block Force Push",
    type: "branch",
    severity: "critical",
    check: (ctx) => {
      const cmd = ctx.input?.tool_input?.command || "";
      if (!/git\s+push/.test(cmd)) return { blocked: false };
      if (/--force(-with-lease)?/.test(cmd)) {
        return { blocked: true, message: "[opencraft] force push blocked. Use normal push." };
      }
      return { blocked: false };
    },
  },
];
