const fs = require("fs");
const path = require("path");

function detectAliases(cwd) {
  const aliases = [];

  for (const configFile of ["tsconfig.json", "jsconfig.json"]) {
    const configPath = path.join(cwd, configFile);
    if (!fs.existsSync(configPath)) continue;
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const clean = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const json = JSON.parse(clean);
      const paths = json?.compilerOptions?.paths;
      if (paths) {
        for (const [alias, targets] of Object.entries(paths)) {
          if (Array.isArray(targets) && targets[0]) {
            aliases.push({ alias, target: targets[0] });
          }
        }
      }
    } catch {}
    if (aliases.length > 0) break;
  }

  return aliases;
}

function detectImportStyle(files) {
  let absolute = 0, relative = 0;
  // Match: import ... from 'path'  or  require('path')
  const importFromRe = /from\s+['"]([^'"]+)['"]/g;
  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const f of files) {
    let m;
    importFromRe.lastIndex = 0;
    while ((m = importFromRe.exec(f.content)) !== null) {
      classifyImport(m[1]);
    }
    requireRe.lastIndex = 0;
    while ((m = requireRe.exec(f.content)) !== null) {
      classifyImport(m[1]);
    }
  }

  function classifyImport(imp) {
    if (imp.startsWith(".") || imp.startsWith("..")) {
      relative++;
    } else if (imp.startsWith("@") || /^[A-Z]/.test(imp)) {
      absolute++;
    }
    // else: bare package names (lodash, react, etc.) — not counted for style
  }

  if (absolute === 0 && relative === 0) return null;
  if (absolute > relative) return "absolute";
  if (relative > absolute) return "relative";
  return "mixed";
}

function detectBarrelExports(files) {
  for (const f of files) {
    const base = f.relPath.split(/[/\\]/).pop();
    if (base === "index.ts" || base === "index.js" || base === "index.tsx" || base === "index.jsx") {
      const reExportCount = (f.content.match(/export\s+\{[^}]*\}\s+from/g) || []).length
        + (f.content.match(/export\s+\*\s+from/g) || []).length;
      if (reExportCount >= 2) return true;
    }
  }
  return false;
}

function scan(files, cwd) {
  return {
    imports: {
      aliases: detectAliases(cwd),
      style: detectImportStyle(files),
      barrelExports: detectBarrelExports(files),
    },
  };
}

module.exports = { scan, detectAliases, detectImportStyle, detectBarrelExports };
