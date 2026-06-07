const fs = require("fs");
const path = require("path");

const EXCLUDE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next",
  ".cache", ".opencraft", "coverage", "__snapshots__",
  "vendor", ".terraform", "venv", "__pycache__",
]);

const EXTENSIONS_BY_STACK = {
  typescript: [".ts", ".tsx"],
  javascript: [".js", ".jsx", ".mjs", ".cjs"],
  python: [".py"],
  go: [".go"],
  rust: [".rs"],
  java: [".java"],
  kotlin: [".kt"],
  ruby: [".rb"],
  php: [".php"],
  dart: [".dart"],
};

function classifyCase(name) {
  if (!name || typeof name !== "string" || name.length === 0) return null;
  if (/^[A-Z][A-Z0-9_]+$/.test(name) && name.includes("_")) return "UPPER_SNAKE";
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return "PascalCase";
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return "camelCase";
  if (/^[a-z][a-z0-9_]+$/.test(name) && name.includes("_")) return "snake_case";
  if (/^[a-z][a-z0-9-]+$/.test(name) && name.includes("-")) return "kebab-case";
  return null;
}

function isExcludedDir(dirName) {
  return EXCLUDE_DIRS.has(dirName);
}

function matchesGitignorePattern(relPath, pattern) {
  if (pattern.startsWith("!")) return false;
  if (pattern.endsWith("/")) {
    const dir = pattern.slice(0, -1);
    return relPath.startsWith(dir + "/") || relPath === dir;
  }
  if (pattern.includes("*")) {
    const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return re.test(relPath);
  }
  return relPath.startsWith(pattern + "/") || relPath === pattern;
}

function isExcluded(relPath, gitignorePatterns) {
  const parts = relPath.split(/[/\\]/);
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) return true;
  }
  for (const p of gitignorePatterns) {
    if (matchesGitignorePattern(relPath, p)) return true;
  }
  return false;
}

function loadGitignore(cwd) {
  const giPath = path.join(cwd, ".gitignore");
  try {
    const content = fs.readFileSync(giPath, "utf-8");
    const patterns = [];
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      patterns.push(t);
    }
    return patterns;
  } catch { return []; }
}

function discoverFiles(cwd, extensions) {
  const gitignore = loadGitignore(cwd);
  const files = [];

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".env") continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(cwd, full);
      if (e.isDirectory()) {
        if (!isExcludedDir(e.name) && !isExcluded(rel, gitignore)) walk(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name);
        if (extensions.includes(ext) && !isExcluded(rel, gitignore)) files.push(rel);
      }
    }
  }

  walk(cwd);
  return files.sort();
}

function readFileContent(cwd, relPath) {
  try { return fs.readFileSync(path.join(cwd, relPath), "utf-8"); } catch { return null; }
}

function loadFiles(cwd, extensions) {
  const paths = discoverFiles(cwd, extensions);
  return paths
    .map(relPath => {
      const content = readFileContent(cwd, relPath);
      return content === null ? null : { relPath, content, ext: path.extname(relPath) };
    })
    .filter(Boolean);
}

function parseSimpleYaml(content) {
  const result = {};
  let currentPath = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const stripped = trimmed.trimStart();

    // List item
    if (stripped.startsWith("- ")) {
      const value = stripped.slice(2).trim().replace(/^['"]|['"]$/g, "");
      if (currentPath.length > 0) {
        let arr = _getNested(result, currentPath);
        if (!Array.isArray(arr)) {
          // Convert from {} to [] when first list item appears
          _setNested(result, currentPath, []);
          arr = _getNested(result, currentPath);
        }
        arr.push(value);
      }
      continue;
    }

    const colonIdx = stripped.indexOf(":");
    if (colonIdx === -1) continue;

    const key = stripped.slice(0, colonIdx).trim();
    let value = stripped.slice(colonIdx + 1).trim();

    const depth = Math.round(indent / 2);
    currentPath = currentPath.slice(0, depth);
    currentPath.push(key);

    if (value) {
      value = value.replace(/^['"]|['"]$/g, "");
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1).split(",").map(s => s.trim().replace(/^['"]|['"]$/g, ""));
      }
      _setNested(result, currentPath, value);
    } else {
      _ensurePath(result, currentPath);
    }
  }
  return result;
}

function _getNested(obj, pathArr) {
  let cur = obj;
  for (const k of pathArr) {
    if (cur[k] === undefined) cur[k] = [];
    cur = cur[k];
  }
  return cur;
}

function _setNested(obj, pathArr, value) {
  let cur = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    if (cur[pathArr[i]] === undefined) cur[pathArr[i]] = {};
    cur = cur[pathArr[i]];
  }
  cur[pathArr[pathArr.length - 1]] = value;
}

function _ensurePath(obj, pathArr) {
  let cur = obj;
  for (const k of pathArr) {
    if (cur[k] === undefined) cur[k] = {};
    cur = cur[k];
  }
}

function loadOverrides(cwd) {
  const p = path.join(cwd, ".opencraft", "overrides.yaml");
  try {
    return parseSimpleYaml(fs.readFileSync(p, "utf-8"));
  } catch { return null; }
}

module.exports = {
  EXCLUDE_DIRS, EXTENSIONS_BY_STACK,
  classifyCase, isExcludedDir, isExcluded,
  loadGitignore, discoverFiles, readFileContent, loadFiles,
  parseSimpleYaml, loadOverrides,
};
