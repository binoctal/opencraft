/**
 * Stop hook — auto-detect decisions in conversation and append to .opencraft/decisions.md.
 *
 * Reads the tool input (stdin) which may contain the assistant's response.
 * Scans for decision signal keywords and extracts decisions.
 * Appends to .opencraft/decisions.md as fallback data source.
 */

const fs = require("fs");
const path = require("path");
const { readToolInput } = require("./utils.cjs");

const DECISION_SIGNALS = [
  // Chinese
  "选择了", "选了", "决定用", "采用", "决定使用",
  "不用", "放弃", "改用",
  // English
  "chose to use", "decided on", "going with",
  "instead of", "replaced with",
];

const MAX_DECISION_LENGTH = 200;
const MAX_FILE_SIZE = 50_000; // 50KB cap for decisions.md

/**
 * Detect decision sentences from text.
 * Returns array of { topic, text, date }.
 */
function detectDecisions(text) {
  if (!text) return [];

  const decisions = [];
  const seen = new Set();

  // Split into sentences
  const sentences = text.split(/[。\n]/).map(s => s.trim()).filter(Boolean);

  for (const sentence of sentences) {
    for (const signal of DECISION_SIGNALS) {
      if (sentence.includes(signal)) {
        // Extract decision text (clean up markdown, quotes)
        const cleaned = sentence
          .replace(/```[\s\S]*?```/g, "")
          .replace(/\[opencraft\].*/g, "")
          .replace(/[#*`]/g, "")
          .trim();

        if (cleaned.length < 10 || cleaned.length > MAX_DECISION_LENGTH) continue;

        // Deduplicate
        const key = cleaned.slice(0, 50);
        if (seen.has(key)) continue;
        seen.add(key);

        // Extract topic
        const topic = extractTopic(cleaned, signal);

        decisions.push({
          topic,
          text: cleaned,
          date: new Date().toISOString().split("T")[0],
        });

        break; // One signal per sentence is enough
      }
    }

    if (decisions.length >= 5) break; // Cap per invocation
  }

  return decisions;
}

/**
 * Extract topic from decision text.
 */
function extractTopic(text, signal) {
  const idx = text.indexOf(signal);
  if (idx <= 0) return text.slice(0, 20);

  // Get text before the signal keyword as topic
  const before = text.slice(Math.max(0, idx - 30), idx).trim();
  if (before.length > 0) return before.slice(-20);

  return text.slice(0, 20);
}

/**
 * Append decisions to .opencraft/decisions.md.
 */
function appendDecisions(cwd, decisions) {
  if (decisions.length === 0) return;

  const dir = path.join(cwd, ".opencraft");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, "decisions.md");

  // Read existing content to check size and deduplicate
  let existing = "";
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, "utf-8");

    // Cap file size
    if (existing.length > MAX_FILE_SIZE) {
      // Trim oldest half
      existing = existing.slice(Math.floor(existing.length / 2));
    }
  } else {
    existing = "# Historical Decisions\n\n<!-- Auto-appended by opencraft stop hook -->\n\n";
  }

  const lines = [];
  for (const d of decisions) {
    // Skip if already present (simple dedup by text prefix)
    if (existing.includes(d.text.slice(0, 40))) continue;

    lines.push(`- ${d.topic}: ${d.text} (${d.date})`);
  }

  if (lines.length === 0) return; // All duplicates

  const content = existing.trimEnd() + "\n" + lines.join("\n") + "\n";
  fs.writeFileSync(filePath, content, "utf-8");
}

function main() {
  const cwd = process.cwd();

  // Guard: only run for activated projects
  const profilePath = path.join(cwd, ".opencraft", "profile.json");
  if (!fs.existsSync(profilePath)) {
    process.exit(0);
  }

  try {
    const input = readToolInput();
    const text = input.stop_hook_active || input.transcript || "";

    // Also check the result field which may contain the assistant's last response
    const resultText = input.result || "";
    const fullText = [text, resultText].filter(Boolean).join("\n");

    if (!fullText) {
      process.exit(0);
    }

    const decisions = detectDecisions(fullText);

    if (decisions.length > 0) {
      appendDecisions(cwd, decisions);
    }

    process.exit(0);
  } catch {
    process.exit(0); // Stop hook should never block
  }
}

main();
