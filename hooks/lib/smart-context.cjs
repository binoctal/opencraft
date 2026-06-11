/**
 * Smart Context - priority-based signal system with token budget.
 *
 * Collects signals from multiple collectors, sorts by priority,
 * and trims to fit within token budget.
 */

const { collect: collectTechStack } = require("./collectors/tech-stack.cjs");
const { collect: collectWorkingTree } = require("./collectors/working-tree.cjs");
const { collect: collectRecentActivity } = require("./collectors/recent-activity.cjs");
const { collect: collectOpenWork } = require("./collectors/open-work.cjs");
const { collect: collectConventions } = require("./collectors/conventions.cjs");

const { collect: collectOpenspec } = require("./collectors/openspec.cjs");
const { collect: collectCiAlignment } = require("./collectors/ci-alignment.cjs");
const { collect: collectClaudeMd } = require("./collectors/claude-md.cjs");
const { collect: collectQualitySnapshot } = require("./collectors/quality-snapshot.cjs");

const DEFAULT_BUDGET = 800;

/**
 * Estimate token count for a string.
 * Rough heuristic: ~4 chars per token for mixed content.
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Collect all signals from all collectors.
 * Each signal: { id, section, priority, tokens, content, action }
 */
function collectSignals(cwd, opts = {}) {
  const signals = [];
  const collectors = [
    { name: "tech-stack", fn: collectTechStack, priority: 50 },
    { name: "working-tree", fn: collectWorkingTree, priority: 75 },
    { name: "recent-activity", fn: collectRecentActivity, priority: 45 },
    { name: "open-work", fn: collectOpenWork, priority: 60 },
    { name: "conventions", fn: collectConventions, priority: 70 },

    { name: "openspec", fn: collectOpenspec, priority: 55 },
    { name: "ci-alignment", fn: collectCiAlignment, priority: 90 },
    { name: "claude-md", fn: collectClaudeMd, priority: 20 },
    { name: "quality-snapshot", fn: collectQualitySnapshot, priority: 65 },
  ];

  for (const { name, fn, priority } of collectors) {
    try {
      const result = fn(cwd, opts);
      if (result && Array.isArray(result)) {
        for (const signal of result) {
          signals.push({
            id: `${name}.${signal.id || "main"}`,
            section: signal.section || name,
            priority: signal.priority || priority,
            tokens: estimateTokens(signal.content),
            content: signal.content,
            action: signal.action || null,
          });
        }
      }
    } catch (e) {
      // Silently skip failing collectors
    }
  }

  return signals;
}

/**
 * Sort signals by priority (descending), then by section.
 */
function sortSignals(signals) {
  return signals.slice().sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.section.localeCompare(b.section);
  });
}

/**
 * Select signals within token budget.
 * Greedy selection from highest priority.
 */
function selectSignals(signals, budget) {
  const sorted = sortSignals(signals);
  const selected = [];
  let used = 0;

  for (const signal of sorted) {
    if (used + signal.tokens <= budget) {
      selected.push(signal);
      used += signal.tokens;
    }
  }

  return selected;
}

/**
 * Group signals by section for formatting.
 */
function groupBySection(signals) {
  const groups = {};
  for (const signal of signals) {
    if (!groups[signal.section]) groups[signal.section] = [];
    groups[signal.section].push(signal);
  }
  return groups;
}

/**
 * Format selected signals into context string.
 */
function formatContext(signals) {
  const groups = groupBySection(signals);
  const lines = [];

  // Sort sections by highest priority signal in each
  const sectionPriority = {};
  for (const signal of signals) {
    const sec = signal.section;
    if (!sectionPriority[sec] || signal.priority > sectionPriority[sec]) {
      sectionPriority[sec] = signal.priority;
    }
  }

  const sortedSections = Object.keys(groups).sort(
    (a, b) => (sectionPriority[b] || 0) - (sectionPriority[a] || 0)
  );

  for (const section of sortedSections) {
    const sectionSignals = groups[section].sort((a, b) => b.priority - a.priority);
    lines.push(`## ${section}`);
    for (const signal of sectionSignals) {
      lines.push(signal.content);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Build smart context with token budget.
 * Main entry point for session-start.cjs.
 */
function buildSmartContext(cwd, opts = {}) {
  const budget = opts.budget || DEFAULT_BUDGET;

  // Collect all signals
  const allSignals = collectSignals(cwd, opts);

  // Select within budget
  const selected = selectSignals(allSignals, budget);

  // Format context
  const context = formatContext(selected);

  // Collect actions
  const actions = selected
    .filter(s => s.action)
    .map(s => s.action);

  // Status message (compact summary)
  const statusParts = [];
  const techStack = allSignals.find(s => s.id === "tech-stack.main");
  if (techStack) statusParts.push(techStack.content.replace("Tech: ", ""));

  const conventions = allSignals.find(s => s.id.startsWith("conventions."));
  if (conventions) {
    const match = conventions.content.match(/(\d+) conventions/);
    if (match) statusParts.push(`${match[1]} conventions`);
  }

  const workingTree = allSignals.find(s => s.id.startsWith("working-tree."));
  if (workingTree && !workingTree.content.includes("Clean")) {
    statusParts.push("uncommitted changes");
  }

  const message = `[opencraft] ${statusParts.join(" | ")}`;

  return {
    context,
    message,
    actions,
    stats: {
      totalSignals: allSignals.length,
      selectedSignals: selected.length,
      tokensUsed: selected.reduce((sum, s) => sum + s.tokens, 0),
      budget,
    },
  };
}

module.exports = {
  buildSmartContext,
  collectSignals,
  sortSignals,
  selectSignals,
  formatContext,
  estimateTokens,
  groupBySection,
  DEFAULT_BUDGET,
};
