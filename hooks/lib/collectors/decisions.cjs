/**
 * Decision Continuity collector.
 * Reads historical decisions from cccmemory SQLite database.
 * Falls back to .opencraft/decisions.md when cccmemory is unavailable.
 */

const fs = require("fs");
const path = require("path");
const { run } = require("../../utils.cjs");

const MAX_DECISIONS = 10;
const CCCMEMORY_PATHS = [
  path.join(process.env.HOME || "", ".cccmemory.db"),
  path.join(process.env.HOME || "", ".config", "cccmemory", "memory.db"),
];

/**
 * Find cccmemory database path.
 */
function findDatabase() {
  for (const dbPath of CCCMEMORY_PATHS) {
    if (fs.existsSync(dbPath)) return dbPath;
  }
  return null;
}

/**
 * Query decisions via Python helper script.
 */
function queryDecisions(dbPath, projectPath) {
  const scriptPath = path.join(__dirname, "query_decisions.py");
  const result = run(
    `python3 "${scriptPath}" "${dbPath}" "${projectPath}" ${MAX_DECISIONS}`,
    { timeout: 3000 }
  );

  if (!result.ok) return [];

  try {
    const data = JSON.parse(result.stdout);
    if (data.error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Read decisions from .opencraft/decisions.md fallback.
 * Format: each line is "- topic: decision (date)"
 */
function readFallback(cwd) {
  const fallbackPath = path.join(cwd, ".opencraft", "decisions.md");
  if (!fs.existsSync(fallbackPath)) return [];

  const content = fs.readFileSync(fallbackPath, "utf-8");
  const lines = content.split("\n").filter(line => line.startsWith("- "));

  return lines.slice(0, MAX_DECISIONS).map(line => {
    const match = line.match(/^- (.+?):\s*(.+?)(?:\s*\((\d{4}-\d{2}-\d{2})\))?$/);
    if (!match) return null;
    return {
      topic: match[1],
      decision_text: match[2],
      date: match[3] || null,
    };
  }).filter(Boolean);
}

/**
 * Extract topic from decision text.
 */
function extractTopic(text) {
  if (!text) return "其他";

  const patterns = [
    /(?:选择|使用|采用|用)\s*(.+)/,
    /(?:不用|放弃|移除)\s*(.+)/,
    /^(.+?)[：:]/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].slice(0, 20);
  }

  return text.slice(0, 15) + (text.length > 15 ? "..." : "");
}

/**
 * Format date from timestamp (milliseconds).
 */
function formatDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}

/**
 * Check if a decision text is meaningful (not a config fragment or noise).
 */
function isQualityDecision(text) {
  if (!text || text.length < 10) return false;
  const cleaned = text.trim();
  // Skip machine-generated config fragments (old handoff system artifacts)
  if (cleaned.startsWith('"') && cleaned.length < 60) return false;
  if (cleaned.startsWith("`")) return false;
  // Skip if it's just a single word/keyword
  if (cleaned.length < 20 && !cleaned.includes(" ")) return false;
  return true;
}

/**
 * Collect decisions as signals for smart context.
 */
function collect(cwd) {
  const signals = [];
  let decisions = [];

  const dbPath = findDatabase();

  if (dbPath) {
    const raw = queryDecisions(dbPath, cwd);
    if (raw.length > 0) {
      decisions = raw
        .filter(d => isQualityDecision(d.decision_text))
        .map(d => ({
          topic: extractTopic(d.decision_text),
          text: d.decision_text,
          date: formatDate(d.timestamp),
        }));
    }
  }

  // Fallback to markdown if cccmemory returned nothing
  if (decisions.length === 0) {
    const fallback = readFallback(cwd);
    if (fallback.length > 0) {
      decisions = fallback.map(d => ({
        topic: d.topic,
        text: d.decision_text,
        date: d.date,
      }));
    }
  }

  if (decisions.length > 0) {
    const lines = decisions.map(d => {
      const dateStr = d.date ? ` (${d.date})` : "";
      return `- ${d.topic}：${d.text}${dateStr}`;
    });

    signals.push({
      id: "main",
      section: "Historical Decisions",
      content: lines.join("\n"),
      priority: 72,
    });
  }

  return signals;
}

module.exports = {
  collect,
  findDatabase,
  queryDecisions,
  readFallback,
  extractTopic,
  formatDate,
  isQualityDecision,
};
