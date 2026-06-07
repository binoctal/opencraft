/**
 * Conventions collector.
 * Returns discovered conventions from v0.7.0 engine.
 */

const { runScan, formatContextSummary, countConventions } = require("../convention-engine.cjs");

function collect(cwd) {
  const signals = [];

  try {
    const scanResult = runScan(cwd);
    const conventions = scanResult.result || null;

    if (conventions) {
      const summary = formatContextSummary(conventions);
      if (summary) {
        signals.push({
          id: "main",
          section: "Conventions",
          content: summary + "\nFull details: .opencraft/conventions.md",
          priority: 70,
        });
      }

      // Count signal
      const count = countConventions(conventions);
      if (count > 0) {
        signals.push({
          id: "count",
          section: "Conventions",
          content: `${count} conventions detected`,
          priority: 35,
        });
      }
    }
  } catch {
    // Convention scan failed
  }

  return signals;
}

module.exports = { collect };
