/**
 * OpenSpec collector.
 * Returns OpenSpec task progress from adapters.
 */

const { detectAdapters } = require("../../adapters/index.cjs");

function collect(cwd) {
  const signals = [];

  try {
    const adapters = detectAdapters(cwd);
    let openspecTasks = [];

    for (const adapter of adapters) {
      if (adapter.getTaskCompletion) {
        openspecTasks = adapter.getTaskCompletion(cwd);
        break;
      }
    }

    if (openspecTasks.length > 0) {
      const lines = [];
      for (const t of openspecTasks) {
        const tag = t.archived ? "archived" : t.phase;
        lines.push(`${t.name}: ${t.done}/${t.total} tasks (${tag}, ${t.pct}%)`);
      }

      signals.push({
        id: "main",
        section: "OpenSpec",
        content: lines.join("\n"),
        priority: 55,
      });

      // Signal incomplete tasks
      const incomplete = openspecTasks.filter(t => t.pct < 100);
      if (incomplete.length > 0) {
        signals.push({
          id: "incomplete",
          section: "Open Work",
          content: `${incomplete.length} incomplete OpenSpec change${incomplete.length > 1 ? "s" : ""}`,
          priority: 50,
        });
      }
    }
  } catch {
    // OpenSpec detection failed
  }

  return signals;
}

module.exports = { collect };
