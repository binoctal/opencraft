/**
 * Working Tree collector.
 * Returns uncommitted file changes.
 */

const { gatherGitIntel } = require("../git-intel.cjs");

function collect(cwd) {
  const signals = [];
  const gitIntel = gatherGitIntel(cwd);

  if (!gitIntel) return signals;

  if (gitIntel.isClean) {
    signals.push({
      id: "status",
      section: "Working Tree",
      content: "Clean working tree",
      priority: 30,
    });
  } else {
    const wt = gitIntel.workingTree;
    const counts = [];
    if (wt.modified) counts.push(`${wt.modified} modified`);
    if (wt.added) counts.push(`${wt.added} added`);
    if (wt.deleted) counts.push(`${wt.deleted} deleted`);
    if (wt.untracked) counts.push(`${wt.untracked} untracked`);

    const lines = [`${counts.join(", ")} (${wt.totalChanges} total)`];
    for (const f of wt.files) {
      lines.push(`  ${f}`);
    }

    signals.push({
      id: "status",
      section: "Working Tree",
      content: lines.join("\n"),
      priority: 75,
    });
  }

  return signals;
}

module.exports = { collect };
