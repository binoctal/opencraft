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

function getTaskCompletion(cwd) {
  const changesDir = path.join(cwd, "openspec", "changes");
  if (!dirExists(changesDir)) return [];

  const results = [];
  try {
    // Scan both active and archived changes
    const dirsToScan = [{ dir: changesDir, archived: false }];
    const archiveDir = path.join(changesDir, "archive");
    if (dirExists(archiveDir)) dirsToScan.push({ dir: archiveDir, archived: true });

    for (const { dir, archived } of dirsToScan) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const changeDir = path.join(dir, entry.name);
        const tasksFile = path.join(changeDir, "tasks.md");
        if (!fileExists(tasksFile)) continue;

        let done = 0, total = 0;
        try {
          const content = fs.readFileSync(tasksFile, "utf-8");
          for (const line of content.split("\n")) {
            if (line.match(/^- \[[ x]\]/i)) {
              total++;
              if (line.match(/^- \[x\]/i)) done++;
            }
          }
        } catch {}

        const phase = detectPhase(changeDir);
        results.push({
          name: entry.name,
          phase,
          done,
          total,
          pct: total > 0 ? Math.round((done / total) * 100) : 0,
          archived,
        });
      }
    }
  } catch {}
  return results;
}

module.exports = {
  name: "openspec",
  getActiveWork,
  getTaskCompletion,
};
