/**
 * Dependency Resolution: codegraph → grep (two-tier fallback)
 *
 * Layer 1: codegraph MCP (AST-level precision, <10ms)
 * Layer 2: on-demand grep (regex-level, <200ms, zero deps)
 *
 * No persistent cache — hooks are short-lived processes.
 * grep is fast enough for <500 file projects.
 */

const fs = require("fs");
const path = require("path");
const { run } = require("../utils.cjs");

const MAX_DEPENDENTS = 10;
const GREP_TIMEOUT_MS = 5000;

// Trivial filenames often produce false positives in grep
// (e.g., index.ts contains the module name in its own re-exports)
const TRIVIAL_FILES = new Set([
  "index", "types", "utils", "helpers", "config",
  "constants", "enums", "interfaces", "mod", "lib",
]);

/**
 * Check if codegraph MCP server is available.
 * Tests by running codegraph_status command.
 */
function codegraphAvailable(cwd) {
  // Check if codegraph CLI is available
  const result = run("which codegraph 2>/dev/null || echo ''", { cwd, timeout: 1000 });
  if (result.ok && result.stdout.trim()) return true;

  // Check if .codegraph directory exists (indexed project)
  const codegraphDir = path.join(cwd, ".codegraph");
  if (fs.existsSync(codegraphDir)) return true;

  return false;
}

/**
 * Query codegraph for files that import/depend on the given file.
 * Returns array of relative file paths.
 */
function queryCodegraph(cwd, filePath) {
  const relPath = path.relative(cwd, filePath);

  // Try codegraph CLI if available
  const whichResult = run("which codegraph 2>/dev/null || echo ''", { cwd, timeout: 1000 });
  if (whichResult.ok && whichResult.stdout.trim()) {
    const codegraphCmd = whichResult.stdout.trim();
    // Query callers of symbols in this file
    const result = run(
      `${codegraphCmd} callers --file "${relPath}" --json 2>/dev/null`,
      { cwd, timeout: 3000 }
    );

    if (result.ok && result.stdout) {
      try {
        const data = JSON.parse(result.stdout);
        const callers = (data.callers || []).map(c => c.file).filter(Boolean);
        return [...new Set(callers)].slice(0, MAX_DEPENDENTS);
      } catch {
        // Fall through to grep
      }
    }
  }

  // Fallback to .codegraph SQLite if directory exists
  const dbPath = path.join(cwd, ".codegraph", "graph.db");
  if (fs.existsSync(dbPath)) {
    return queryCodegraphSqlite(dbPath, relPath);
  }

  return [];
}

/**
 * Query codegraph SQLite database directly.
 */
function queryCodegraphSqlite(dbPath, relPath) {
  const script = `
import sqlite3
import json
import sys

db_path = sys.argv[1]
file_path = sys.argv[2]

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# Find edges where this file is the target (imported by others)
cursor = conn.execute("""
    SELECT DISTINCT e.source_file
    FROM edges e
    WHERE e.target_file = ?
    LIMIT ?
""", (file_path, ${MAX_DEPENDENTS}))

results = [row["source_file"] for row in cursor.fetchall()]
print(json.dumps(results))
`;

  const result = run(
    `python3 -c '${script.replace(/'/g, "'\"'\"'")}' "${dbPath}" "${relPath}"`,
    { timeout: 3000 }
  );

  if (!result.ok) return [];

  try {
    const data = JSON.parse(result.stdout);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Grep for files that import the given file.
 * Searches for import statements referencing the file's basename or path.
 */
function grepImportPaths(cwd, filePath, extensions) {
  const relPath = path.relative(cwd, filePath);
  const basename = path.basename(filePath, path.extname(filePath));
  const basenameWithExt = path.basename(filePath);
  const dir = path.dirname(relPath);

  // Build grep patterns for different import styles
  // Use simpler patterns that work reliably with grep -E
  const patterns = [
    // CommonJS: require('...basename...') or require('...basename.ext')
    `require.*${escapeRegex(basename)}`,
    `require.*${escapeRegex(basenameWithExt)}`,
    // ES modules: import ... from '...basename...'
    `import.*from.*${escapeRegex(basename)}`,
    `import.*${escapeRegex(basename)}`,
    // Python: from ...basename import or import ...basename
    `from.*${escapeRegex(basename)}.*import`,
    // Go: import "...basename"
    `".*${escapeRegex(basename)}"`,
  ];

  // Build extension filter
  const extFilter = extensions && extensions.length > 0
    ? extensions.map(e => `--include="*${e}"`).join(" ")
    : '--include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.go" --include="*.rs" --include="*.java"';

  // Exclude the file itself and common non-source dirs
  const excludeArgs = [
    `--exclude-dir=node_modules`,
    `--exclude-dir=vendor`,
    `--exclude-dir=.git`,
    `--exclude-dir=dist`,
    `--exclude-dir=build`,
    `--exclude-dir=.cache`,
    `--exclude-dir=learning`,
    `--exclude-dir=examples`,
    `--exclude-dir=docs`,
    `--exclude-dir=.claude`,
    `--exclude-dir=openspec`,
  ].join(" ");

  const dependents = new Set();

  for (const pattern of patterns) {
    const cmd = `grep -rl ${extFilter} ${excludeArgs} -E "${pattern}" . 2>/dev/null | head -${MAX_DEPENDENTS}`;
    const result = run(cmd, { cwd, timeout: GREP_TIMEOUT_MS });

    if (result.ok && result.stdout) {
      for (const line of result.stdout.split("\n").filter(Boolean)) {
        // Normalize path: remove leading ./
        let p = line.replace(/^\.\//, "");
        // Skip the file itself
        if (p === relPath || p === filePath) continue;
        // Skip if already found
        if (dependents.has(p)) continue;
        dependents.add(p);
        if (dependents.size >= MAX_DEPENDENTS) break;
      }
    }

    if (dependents.size >= MAX_DEPENDENTS) break;
  }

  // Filter out trivial filenames (index.ts, types.ts, etc.)
  // These often contain the module name in re-exports and produce false positives
  const filtered = [...dependents].filter(p => {
    const basename = path.basename(p, path.extname(p));
    return !TRIVIAL_FILES.has(basename);
  });

  return filtered;
}

/**
 * Escape special regex characters.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Main entry point: get files that depend on (import) the given file.
 * Two-tier fallback: codegraph → grep.
 */
function getDependents(cwd, filePath, extensions) {
  // Layer 1: codegraph
  if (codegraphAvailable(cwd)) {
    const codegraphDeps = queryCodegraph(cwd, filePath);
    if (codegraphDeps.length > 0) {
      return { dependents: codegraphDeps, source: "codegraph" };
    }
    // codegraph returned empty — could mean no dependents or query failed
    // Fall through to grep to verify
  }

  // Layer 2: grep
  const grepDeps = grepImportPaths(cwd, filePath, extensions);
  return { dependents: grepDeps, source: "grep" };
}

/**
 * Format dependents into a warning message.
 */
function formatWarning(filePath, result) {
  const { dependents, source } = result;
  if (dependents.length === 0) return null;

  const lines = [
    `[opencraft] ⚠ Modified ${path.basename(filePath)} — ${dependents.length} file${dependents.length > 1 ? "s" : ""} depend${dependents.length === 1 ? "s" : ""} on it:`,
  ];

  for (const dep of dependents.slice(0, 5)) {
    lines.push(`  - ${dep}`);
  }

  if (dependents.length > 5) {
    lines.push(`  ... and ${dependents.length - 5} more`);
  }

  lines.push(`  Verify these call sites are updated.`);
  lines.push(`  (source: ${source})`);

  return lines.join("\n");
}

module.exports = {
  getDependents,
  codegraphAvailable,
  queryCodegraph,
  grepImportPaths,
  formatWarning,
  escapeRegex,
  MAX_DEPENDENTS,
  TRIVIAL_FILES,
};
