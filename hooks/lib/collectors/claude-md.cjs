/**
 * CLAUDE.md collector.
 * Checks CLAUDE.md line count against 80-line limit.
 */

const path = require("path");
const { countLines } = require("../../utils.cjs");

const MAX_LINES = 80;

function collect(cwd) {
  const signals = [];

  const claudeMdPath = path.join(cwd, ".claude", "CLAUDE.md");
  const lines = countLines(claudeMdPath);

  if (lines === 0) {
    signals.push({
      id: "missing",
      section: "Signals",
      content: "No .claude/CLAUDE.md found. Consider creating one.",
      priority: 15,
    });
  } else if (lines > MAX_LINES) {
    signals.push({
      id: "oversize",
      section: "Signals",
      content: `CLAUDE.md: ${lines} lines (exceeds ${MAX_LINES}-line limit, consider splitting)`,
      priority: 20,
    });
  }

  return signals;
}

module.exports = { collect };
