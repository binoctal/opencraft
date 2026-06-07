/**
 * Tech Stack collector.
 * Returns technology stack and verify commands.
 */

const { getOrCreateProfile } = require("../detection.cjs");

function collect(cwd) {
  const signals = [];

  try {
    const { profile } = getOrCreateProfile(cwd);

    const parts = [`Tech: ${profile.techStack.join(", ")}`];
    if (profile.verify && profile.verify.length > 0) {
      parts.push(`Verify: ${profile.verify.join(", ")}`);
    }

    signals.push({
      id: "main",
      section: "Project",
      content: parts.join(" | "),
      priority: 50,
    });
  } catch {
    // Profile not available
  }

  return signals;
}

module.exports = { collect };
