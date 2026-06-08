#!/usr/bin/env node
// scripts/sync.cjs — Sync opencraft plugin to cache + marketplace
// Usage: node scripts/sync.cjs [--dry-run] [--hook <hook-name>]
//   --dry-run   Preview what would be synced
//   --hook      Generate hooks.json for a specific install path (prints to stdout)
//
// Auto-detects install targets under ~/.claude/plugins/
// Called by .git/hooks/post-push (or manually)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const HOME = process.env.HOME || process.env.USERPROFILE;
const PLUGIN_NAME = "opencraft";
const CACHE_BASE = path.join(HOME, ".claude", "plugins", "cache", PLUGIN_NAME, PLUGIN_NAME);
const MARKET_DIR = path.join(HOME, ".claude", "plugins", "marketplaces", PLUGIN_NAME);

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const hookIdx = args.indexOf("--hook");
const hookMode = hookIdx !== -1 && args[hookIdx + 1];

// ── Hooks.json generation ──────────────────────────────────────────
// Generates hooks.json with correct paths for a given install directory

function generateHooksJson(installDir) {
  const h = (name) => `node "${installDir}/hooks/${name}"`;
  return {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|clear|compact",
          hooks: [{ type: "command", command: h("session-start.cjs"), timeout: 5 }],
        },
      ],
      PreToolUse: [
        { matcher: "Write(*)", hooks: [{ type: "command", command: h("pre-tool-use.cjs"), timeout: 5 }] },
        { matcher: "Edit(*)", hooks: [{ type: "command", command: h("pre-tool-use.cjs"), timeout: 5 }] },
        { matcher: "Bash(git push*)", hooks: [{ type: "command", command: h("pre-tool-use.cjs"), timeout: 5 }] },
      ],
      PostToolUse: [
        { matcher: "Bash(*)", hooks: [{ type: "command", command: h("post-tool-use.cjs"), timeout: 120 }] },
        { matcher: "Write(*)", hooks: [{ type: "command", command: h("post-tool-use.cjs"), timeout: 5 }] },
        { matcher: "Edit(*)", hooks: [{ type: "command", command: h("post-tool-use.cjs"), timeout: 5 }] },
      ],
      SessionEnd: [],
    },
  };
}

// ── Hook mode: just print generated hooks.json and exit ─────────────
if (hookMode) {
  const installDir = hookMode;
  process.stdout.write(JSON.stringify(generateHooksJson(installDir), null, 2) + "\n");
  process.exit(0);
}

// ── Collect sync targets ────────────────────────────────────────────

function findTargets() {
  const targets = [];

  // Cache: all versioned directories
  if (fs.existsSync(CACHE_BASE)) {
    for (const entry of fs.readdirSync(CACHE_BASE, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const verDir = path.join(CACHE_BASE, entry.name);
        // Skip non-version-like dirs and .in_use markers
        if (/^\d/.test(entry.name)) {
          targets.push({ path: verDir, type: "cache", version: entry.name });
        }
      }
    }
  }

  // Marketplace
  if (fs.existsSync(MARKET_DIR)) {
    targets.push({ path: MARKET_DIR, type: "marketplace", version: "live" });
  }

  return targets;
}

// ── Sync logic ──────────────────────────────────────────────────────

const SYNC_DIRS = ["hooks", "skills", "openspec"];
const SYNC_FILES = ["package.json"];
const SYNC_MANIFESTS = [
  { src: ".claude-plugin/plugin.json", dest: ".claude-plugin/plugin.json" },
  { src: ".claude-plugin/marketplace.json", dest: ".claude-plugin/marketplace.json" },
];
const SKIP_PATTERNS = [".in_use", ".git", "__pycache__", "node_modules"];

function shouldSkip(name) {
  return SKIP_PATTERNS.some((p) => name === p || name.startsWith(p));
}

function syncDir(src, dest, label) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src);
  for (const entry of entries) {
    if (shouldSkip(entry)) continue;
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);

    if (fs.statSync(srcPath).isDirectory()) {
      if (!dryRun) fs.mkdirSync(destPath, { recursive: true });
      syncDir(srcPath, destPath, label);
    } else {
      if (dryRun) {
        const rel = path.relative(REPO_ROOT, srcPath);
        console.log(`  [dry-run] ${rel} → ${destPath}`);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

function sync(target) {
  const { path: targetPath, type, version } = target;
  const label = type === "cache" ? `cache/${version}` : "marketplace";
  console.log(`[opencraft] Syncing to ${label}...`);

  // Sync directories (additive — don't delete existing target-only files)
  for (const dir of SYNC_DIRS) {
    const src = path.join(REPO_ROOT, dir);
    if (fs.existsSync(src)) {
      const dest = path.join(targetPath, dir);
      if (!dryRun) fs.mkdirSync(dest, { recursive: true });
      syncDir(src, dest, label);
    }
  }

  // Sync root files
  for (const file of SYNC_FILES) {
    const src = path.join(REPO_ROOT, file);
    if (fs.existsSync(src)) {
      const dest = path.join(targetPath, file);
      if (dryRun) {
        console.log(`  [dry-run] ${file} → ${dest}`);
      } else {
        fs.copyFileSync(src, dest);
      }
    }
  }

  // Sync plugin manifests
  for (const { src: srcRel, dest: destRel } of SYNC_MANIFESTS) {
    const src = path.join(REPO_ROOT, srcRel);
    if (fs.existsSync(src)) {
      const dest = path.join(targetPath, destRel);
      if (!dryRun) fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (dryRun) {
        console.log(`  [dry-run] ${srcRel} → ${dest}`);
      } else {
        fs.copyFileSync(src, dest);
      }
    }
  }

  // Generate hooks.json with correct paths for this target
  const hooksJson = generateHooksJson(targetPath);
  const hooksDest = path.join(targetPath, "hooks", "hooks.json");
  if (dryRun) {
    console.log(`  [dry-run] hooks.json (generated) → ${hooksDest}`);
  } else {
    fs.writeFileSync(hooksDest, JSON.stringify(hooksJson, null, 2) + "\n");
  }

  // Clean .in_use lock files
  if (!dryRun) {
    cleanLockFiles(targetPath);
  }

  console.log(`[opencraft] ✅ ${label} synced`);
}

// ── Lock file cleanup ───────────────────────────────────────────────

function cleanLockFiles(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".in_use") {
        const fullPath = path.join(dir, entry.name);
        // Only remove stale locks (not modified in last hour)
        const stat = fs.statSync(fullPath);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs > 3600000) {
          fs.unlinkSync(fullPath);
          console.log(`  🧹 Cleaned stale lock: ${fullPath}`);
        }
      }
      if (entry.isDirectory() && !shouldSkip(entry.name)) {
        cleanLockFiles(path.join(dir, entry.name));
      }
    }
  } catch {}
}

// ── Main ────────────────────────────────────────────────────────────

const targets = findTargets();
if (targets.length === 0) {
  console.log("[opencraft] No install targets found. Install with: claude plugin install opencraft");
  process.exit(0);
}

console.log(`[opencraft] Found ${targets.length} target(s)`);
for (const target of targets) {
  sync(target);
}
if (dryRun) {
  console.log("\n[opencraft] Dry run complete — no files were changed");
}
