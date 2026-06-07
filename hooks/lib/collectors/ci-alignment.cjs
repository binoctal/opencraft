/**
 * CI Alignment collector.
 * Returns CI command mismatches.
 */

const { checkAlignment } = require("../ci-alignment.cjs");
const { getOrCreateProfile } = require("../detection.cjs");

function collect(cwd) {
  const signals = [];

  try {
    const { profile } = getOrCreateProfile(cwd);
    const mismatches = checkAlignment(cwd, profile);

    if (mismatches.length > 0) {
      const lines = [];
      for (const m of mismatches) {
        lines.push(`${m.category}: CI runs \`${m.ci}\`, profile has \`${m.profile.join(", ")}\``);
      }

      signals.push({
        id: "main",
        section: "CI Alignment",
        content: lines.join("\n"),
        priority: 90,
        action: { type: "warn", message: "CI alignment mismatch detected" },
      });
    }
  } catch {
    // CI alignment check failed
  }

  return signals;
}

module.exports = { collect };
