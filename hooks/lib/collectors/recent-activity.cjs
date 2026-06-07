/**
 * Recent Activity collector.
 * Returns recent git commits.
 */

const { gatherGitIntel } = require("../git-intel.cjs");

function collect(cwd) {
  const signals = [];
  const gitIntel = gatherGitIntel(cwd);

  if (!gitIntel || gitIntel.recentCommits.length === 0) return signals;

  const lines = [];
  for (const c of gitIntel.recentCommits) {
    lines.push(`${c.hash} ${c.subject}`);
  }

  signals.push({
    id: "commits",
    section: "Recent Activity",
    content: lines.join("\n"),
    priority: 45,
  });

  // Branch info
  if (gitIntel.branch) {
    signals.push({
      id: "branch",
      section: "Project",
      content: `Branch: ${gitIntel.branch}`,
      priority: 40,
    });
  }

  return signals;
}

module.exports = { collect };
