/**
 * Quality Snapshot collector.
 * Returns quality trends and anti-patterns.
 */

const {
  collectMetrics,
  loadPrevious,
  saveSnapshot,
  compareTrends,
  formatTrends,
  formatAntiPatterns,
} = require("../quality-snapshot.cjs");

function collect(cwd) {
  const signals = [];

  try {
    const current = collectMetrics(cwd);
    if (!current) return signals;

    const previous = loadPrevious(cwd);
    const trends = compareTrends(current, previous);

    // Save current snapshot
    saveSnapshot(cwd, current);

    // Quality trend signal
    if (trends.length > 0) {
      const trendText = formatTrends(trends);
      if (trendText) {
        signals.push({
          id: "trends",
          section: "Quality",
          content: trendText,
          priority: 65,
        });
      }
    }

    // Anti-patterns signal
    if (current.antiPatterns.length > 0) {
      const patternText = formatAntiPatterns(current.antiPatterns);
      if (patternText) {
        signals.push({
          id: "anti-patterns",
          section: "Quality",
          content: patternText,
          priority: 55,
        });
      }
    }

    // Summary metric signal
    const m = current.metrics;
    const summary = `Quality: ${m.fnCount} functions (avg ${m.avgFnLength} lines), ${m.fileCount} files, ${m.todoCount} TODOs, test ratio ${m.testRatio}`;
    signals.push({
      id: "summary",
      section: "Quality",
      content: summary,
      priority: 40,
    });
  } catch {
    // Quality snapshot failed
  }

  return signals;
}

module.exports = { collect };
