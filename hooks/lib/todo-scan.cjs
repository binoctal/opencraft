const fs = require("fs");
const path = require("path");
const { run } = require("../utils.cjs");

const MAX_FILES = 30;
const MAX_RESULTS = 10;
const MAX_FILE_SIZE = 100_000; // 100KB
const TODO_RE = /\b(TODO|FIXME|HACK)\b/;

function scanRecentTodos(cwd, changedFiles) {
  if (!changedFiles || !changedFiles.length) return [];

  const files = _dedupeFiles(changedFiles).slice(0, MAX_FILES);
  const results = [];

  for (const filePath of files) {
    if (results.length >= MAX_RESULTS) break;
    const full = path.join(cwd, filePath);
    const items = _scanFile(full, filePath);
    for (const item of items) {
      results.push(item);
      if (results.length >= MAX_RESULTS) break;
    }
  }
  return results;
}

function getChangedAndRecentFiles(cwd) {
  const files = new Set();

  // Working tree changes
  const st = run("git diff --name-only HEAD", { cwd, timeout: 2000 });
  if (st.ok) st.stdout.split("\n").filter(Boolean).forEach(f => files.add(f));

  // Untracked files
  const ut = run("git ls-files --others --exclude-standard", { cwd, timeout: 2000 });
  if (ut.ok) ut.stdout.split("\n").filter(Boolean).forEach(f => files.add(f));

  // Last 5 commits
  const rc = run("git diff --name-only HEAD~5 HEAD", { cwd, timeout: 2000 });
  if (rc.ok) rc.stdout.split("\n").filter(Boolean).forEach(f => files.add(f));

  return [...files];
}

function _scanFile(fullPath, relativePath) {
  try {
    const stat = fs.statSync(fullPath);
    if (stat.size > MAX_FILE_SIZE) return [];
    const content = fs.readFileSync(fullPath, "utf-8");
    const results = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(TODO_RE);
      if (match) {
        results.push({
          file: relativePath,
          line: i + 1,
          type: match[1],
          text: lines[i].trim().slice(0, 60),
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

function _dedupeFiles(files) {
  return [...new Set(files)];
}

module.exports = { scanRecentTodos, getChangedAndRecentFiles };
