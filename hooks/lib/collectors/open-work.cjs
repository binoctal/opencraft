/**
 * Open Work collector.
 * Returns unmerged branches, TODOs in changed files, stash count.
 */

const { gatherGitIntel } = require("../git-intel.cjs");
const { scanRecentTodos, getChangedAndRecentFiles } = require("../todo-scan.cjs");

function collect(cwd) {
  const signals = [];
  const gitIntel = gatherGitIntel(cwd);

  if (!gitIntel) return signals;

  const items = [];

  // Unmerged branches
  const { unmergedBranches, stashCount } = gitIntel;
  if (unmergedBranches.total > 0) {
    const names = unmergedBranches.shown.map(b => `${b.name} (${b.lastCommit})`);
    items.push(`${unmergedBranches.total} unmerged branch${unmergedBranches.total > 1 ? "es" : ""}: ${names.join(", ")}`);
  }

  // TODOs in changed files
  try {
    const files = getChangedAndRecentFiles(cwd);
    const todos = scanRecentTodos(cwd, files);
    if (todos.length > 0) {
      const todoSummary = todos.map(t => `${t.file}:L${t.line}`).join(", ");
      items.push(`${todos.length} TODO${todos.length > 1 ? "s" : ""} in changed files: ${todoSummary}`);
    }
  } catch {
    // TODO scan failed
  }

  // Stash
  if (stashCount > 0) {
    items.push(`${stashCount} stashed change${stashCount > 1 ? "s" : ""}`);
  }

  if (items.length > 0) {
    signals.push({
      id: "main",
      section: "Open Work",
      content: items.join("\n"),
      priority: 60,
    });
  }

  return signals;
}

module.exports = { collect };
