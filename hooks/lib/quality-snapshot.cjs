/**
 * Quality Baseline Snapshot.
 *
 * Collects quality metrics and compares to previous snapshot.
 * Detects trends and anti-patterns.
 *
 * Metrics:
 * - Avg/P75 function length
 * - Avg/Max file length
 * - TODO count
 * - Test ratio
 * - Duplicate blocks
 * - Anti-patterns (large files, god modules)
 */

const fs = require("fs");
const path = require("path");
const { loadFiles } = require("./scan-utils.cjs");

const SNAPSHOT_PATH = ".opencraft/quality-snapshot.json";
const MAX_FILE_THRESHOLD = 400;
const EXPORT_COUNT_THRESHOLD = 10;
const AVG_FN_LENGTH_THRESHOLD = 40;

/**
 * Count functions and measure lengths.
 * Uses regex-based detection (same as structure scanner).
 */
function measureFunctions(files) {
  const lengths = [];

  // Patterns for function declarations
  const patterns = [
    /function\s+\w+\s*\([^)]*\)\s*\{/g,
    /const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
    /const\s+\w+\s*=\s*(?:async\s+)?function\s*\([^)]*\)/g,
    /(?:async\s+)?\w+\s*\([^)]*\)\s*\{/g, // method shorthand
  ];

  for (const file of files) {
    const lines = file.content.split("\n");
    let braceDepth = 0;
    let fnStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect function start
      if (fnStart === -1) {
        for (const pattern of patterns) {
          pattern.lastIndex = 0;
          if (pattern.test(line)) {
            fnStart = i;
            break;
          }
        }
      }

      // Count braces
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        else if (ch === "}") braceDepth--;
      }

      // Detect function end
      if (fnStart !== -1 && braceDepth === 0 && i > fnStart) {
        const length = i - fnStart + 1;
        if (length >= 2 && length <= 500) {
          lengths.push(length);
        }
        fnStart = -1;
      }
    }
  }

  if (lengths.length === 0) {
    return { avg: 0, p75: 0, p90: 0, count: 0 };
  }

  lengths.sort((a, b) => a - b);
  const sum = lengths.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / lengths.length);
  const p75 = lengths[Math.floor(lengths.length * 0.75)] || 0;
  const p90 = lengths[Math.floor(lengths.length * 0.90)] || 0;

  return { avg, p75, p90, count: lengths.length };
}

/**
 * Measure file lengths.
 */
function measureFiles(files) {
  const lengths = files.map(f => f.content.split("\n").length);

  if (lengths.length === 0) {
    return { avg: 0, max: 0, count: 0 };
  }

  const sum = lengths.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / lengths.length);
  const max = Math.max(...lengths);

  return { avg, max, count: lengths.length };
}

/**
 * Count TODO/FIXME/HACK comments.
 */
function countTodos(files) {
  let count = 0;
  const pattern = /(?:TODO|FIXME|HACK|XXX)\b/gi;

  for (const file of files) {
    const matches = file.content.match(pattern);
    if (matches) count += matches.length;
  }

  return count;
}

/**
 * Calculate test ratio.
 * test ratio = test files / total source files
 */
function calcTestRatio(files) {
  const testPattern = /\.(test|spec)\.(ts|tsx|js|jsx|cjs|mjs|py)$/i;
  const testDirPattern = /(?:^|\/)(?:test|tests|__tests__|spec)\//i;
  const testFiles = files.filter(f => testPattern.test(f.relPath) || testDirPattern.test(f.relPath)).length;
  const total = files.length;

  if (total === 0) return 0;
  return Math.round((testFiles / total) * 100) / 100;
}

/**
 * Find duplicate code blocks (6-line hash matching).
 */
function findDuplicates(files) {
  const BLOCK_SIZE = 6;
  const hashes = new Map();
  let duplicates = 0;

  for (const file of files) {
    const lines = file.content.split("\n");

    for (let i = 0; i <= lines.length - BLOCK_SIZE; i++) {
      const block = lines.slice(i, i + BLOCK_SIZE)
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join("\n");

      if (block.length < 20) continue;

      const hash = simpleHash(block);

      if (hashes.has(hash) && hashes.get(hash) !== file.relPath) {
        duplicates++;
        // Only count each pair once
        hashes.delete(hash);
      } else if (!hashes.has(hash)) {
        hashes.set(hash, file.relPath);
      }
    }
  }

  return duplicates;
}

/**
 * Simple string hash.
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Detect anti-patterns.
 */
function detectAntiPatterns(files) {
  const patterns = [];

  for (const file of files) {
    const lines = file.content.split("\n").length;

    // Large file
    if (lines > MAX_FILE_THRESHOLD) {
      patterns.push({
        type: "large-file",
        file: file.relPath,
        detail: `${lines} lines, exceeding ${MAX_FILE_THRESHOLD} — consider splitting`,
        severity: "warning",
      });
    }

    // God module (many exports)
    const exportPattern = /(?:export\s+(?:default\s+)?(?:function|class|const|let|var)|module\.exports\s*=|exports\.\w+\s*=)/g;
    const exports = (file.content.match(exportPattern) || []).length;

    if (exports >= EXPORT_COUNT_THRESHOLD) {
      patterns.push({
        type: "god-module",
        file: file.relPath,
        detail: `${exports} exports — consider splitting by domain`,
        severity: "info",
      });
    }

    // Long functions
    const fnLengths = measureFunctions([file]);
    if (fnLengths.avg > AVG_FN_LENGTH_THRESHOLD) {
      patterns.push({
        type: "long-functions",
        file: file.relPath,
        detail: `avg function ${fnLengths.avg} lines — consider refactoring`,
        severity: "info",
      });
    }
  }

  return patterns;
}

/**
 * Collect all quality metrics.
 */
function collectMetrics(cwd, extensions) {
  const files = loadFiles(cwd, extensions || [".ts", ".tsx", ".js", ".jsx", ".py"]);

  if (files.length === 0) {
    return null;
  }

  const functions = measureFunctions(files);
  const fileStats = measureFiles(files);
  const todos = countTodos(files);
  const testRatio = calcTestRatio(files);
  const duplicates = findDuplicates(files);
  const antiPatterns = detectAntiPatterns(files);

  return {
    timestamp: Date.now(),
    metrics: {
      avgFnLength: functions.avg,
      p75FnLength: functions.p75,
      p90FnLength: functions.p90,
      fnCount: functions.count,
      avgFileLength: fileStats.avg,
      maxFileLength: fileStats.max,
      fileCount: fileStats.count,
      todoCount: todos,
      testRatio,
      duplicateBlocks: duplicates,
    },
    antiPatterns: antiPatterns.slice(0, 10),
  };
}

/**
 * Load previous snapshot.
 */
function loadPrevious(cwd) {
  const snapshotPath = path.join(cwd, SNAPSHOT_PATH);
  try {
    return JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Save current snapshot.
 */
function saveSnapshot(cwd, snapshot) {
  const dir = path.join(cwd, ".opencraft");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(cwd, SNAPSHOT_PATH), JSON.stringify(snapshot, null, 2), "utf-8");
}

/**
 * Compare current metrics to previous.
 * Returns array of trend items.
 */
function compareTrends(current, previous) {
  if (!previous || !previous.metrics) return [];

  const trends = [];
  const curr = current.metrics;
  const prev = previous.metrics;

  // Function length
  if (prev.avgFnLength > 0 && curr.avgFnLength !== prev.avgFnLength) {
    const pct = Math.round(((curr.avgFnLength - prev.avgFnLength) / prev.avgFnLength) * 100);
    const arrow = pct > 0 ? "↑" : "↓";
    trends.push({
      metric: "函数平均长度",
      from: prev.avgFnLength,
      to: curr.avgFnLength,
      change: `${arrow}${Math.abs(pct)}%`,
      direction: pct > 0 ? "worse" : "better",
    });
  }

  // Max file length
  if (prev.maxFileLength > 0 && curr.maxFileLength !== prev.maxFileLength) {
    const pct = Math.round(((curr.maxFileLength - prev.maxFileLength) / prev.maxFileLength) * 100);
    const arrow = pct > 0 ? "↑" : "↓";
    trends.push({
      metric: "最大文件",
      from: prev.maxFileLength,
      to: curr.maxFileLength,
      change: `${arrow}${Math.abs(pct)}%`,
      direction: pct > 0 ? "worse" : "better",
    });
  }

  // TODO count
  if (curr.todoCount !== prev.todoCount) {
    const diff = curr.todoCount - prev.todoCount;
    const arrow = diff > 0 ? "↑" : "↓";
    trends.push({
      metric: "TODO 数量",
      from: prev.todoCount,
      to: curr.todoCount,
      change: `${arrow}${Math.abs(diff)}`,
      direction: diff > 0 ? "worse" : "better",
    });
  }

  // Test ratio
  if (prev.testRatio > 0 && curr.testRatio !== prev.testRatio) {
    const diff = Math.round((curr.testRatio - prev.testRatio) * 100);
    const arrow = diff > 0 ? "↑" : "↓";
    trends.push({
      metric: "测试比",
      from: prev.testRatio,
      to: curr.testRatio,
      change: `${arrow}${Math.abs(diff)}%`,
      direction: diff > 0 ? "better" : "worse",
    });
  }

  // Duplicate blocks
  if (curr.duplicateBlocks !== prev.duplicateBlocks) {
    const diff = curr.duplicateBlocks - prev.duplicateBlocks;
    const arrow = diff > 0 ? "↑" : "↓";
    trends.push({
      metric: "重复代码块",
      from: prev.duplicateBlocks,
      to: curr.duplicateBlocks,
      change: `${arrow}${Math.abs(diff)}`,
      direction: diff > 0 ? "worse" : "better",
    });
  }

  // Filter to significant changes (>5%)
  return trends.filter(t => {
    if (t.change.includes("%")) {
      const pct = parseInt(t.change.replace(/[^0-9]/g, ""));
      return pct >= 5;
    }
    return true;
  });
}

/**
 * Format trends for context injection.
 */
function formatTrends(trends) {
  if (trends.length === 0) return null;

  const lines = ["## Quality Trend"];
  for (const t of trends) {
    lines.push(`${t.metric}：${t.from} → ${t.to}（${t.change}）`);
  }

  return lines.join("\n");
}

/**
 * Format anti-patterns for context injection.
 */
function formatAntiPatterns(patterns) {
  if (patterns.length === 0) return null;

  const lines = ["## Attention"];
  for (const p of patterns.slice(0, 5)) {
    lines.push(`- ${p.file}: ${p.detail}`);
  }

  return lines.join("\n");
}

module.exports = {
  collectMetrics,
  loadPrevious,
  saveSnapshot,
  compareTrends,
  formatTrends,
  formatAntiPatterns,
  measureFunctions,
  measureFiles,
  countTodos,
  calcTestRatio,
  findDuplicates,
  detectAntiPatterns,
  simpleHash,
  MAX_FILE_THRESHOLD,
  EXPORT_COUNT_THRESHOLD,
};
