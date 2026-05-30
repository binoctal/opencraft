const fs = require("fs");
const path = require("path");
const { dirExists, fileExists } = require("../utils.cjs");

const ARTIFACT_PHASES = ["proposal", "specs", "design", "tasks"];

function detectPhase(changeDir) {
  let lastPhase = "proposal";
  for (const phase of ARTIFACT_PHASES) {
    if (fileExists(path.join(changeDir, `${phase}.md`))) {
      lastPhase = phase;
    }
  }
  return lastPhase;
}

function getActiveWork(cwd) {
  const changesDir = path.join(cwd, "openspec", "changes");
  if (!dirExists(changesDir)) return { activeWork: [], status: { summary: "no active work", details: [] } };

  const activeWork = [];
  try {
    const entries = fs.readdirSync(changesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const changeDir = path.join(changesDir, entry.name);
      // Skip archived changes
      if (fileExists(path.join(changeDir, "archived"))) continue;
      const phase = detectPhase(changeDir);
      activeWork.push({ name: entry.name, phase });
    }
  } catch {}

  const summary = activeWork.length > 0
    ? `${activeWork.length} active change${activeWork.length > 1 ? "s" : ""}`
    : "no active changes";
  const details = activeWork.map((w) => `${w.name} (${w.phase})`);

  return { activeWork, status: { summary, details } };
}

module.exports = {
  name: "openspec",
  getActiveWork,
};
