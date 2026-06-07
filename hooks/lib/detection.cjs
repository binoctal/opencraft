const fs = require("fs");
const path = require("path");
const { fileExists, dirExists, run } = require("../utils.cjs");

const OPENCRAFT_VERSION = require("../../package.json").version;

const FINGERPRINTS = [
  { file: "go.mod", stack: "go", verify: ["go vet ./...", "go test ./..."], build: ["go build ./..."] },
  { file: "tsconfig.json", stack: "typescript", verify: ["npx tsc --noEmit"] },
  { file: "pyproject.toml", stack: "python", verify: ["pytest"] },
  { file: "setup.py", stack: "python", verify: ["pytest"] },
  { file: "Cargo.toml", stack: "rust", verify: ["cargo check", "cargo test"] },
  { file: "pom.xml", stack: "java", verify: ["mvn test"] },
  { file: "build.gradle", stack: "java", verify: ["gradle test"] },
  { file: "build.gradle.kts", stack: "kotlin", verify: ["./gradlew test"] },
  { file: "Gemfile", stack: "ruby", verify: ["bundle exec rspec"] },
  { file: "composer.json", stack: "php", verify: ["phpunit"] },
  { file: "*.csproj", stack: "dotnet", verify: ["dotnet test"] },
  { file: "*.sln", stack: "dotnet", verify: ["dotnet test"] },
  { file: "Package.swift", stack: "swift", verify: ["swift test"] },
  { file: "mix.exs", stack: "elixir", verify: ["mix test"] },
  { file: "pubspec.yaml", stack: "dart", verify: ["flutter test"] },
];

const AUX_FINGERPRINTS = [
  { file: "Dockerfile", stack: "docker" },
  { file: "docker-compose.yml", stack: "docker" },
  { file: "docker-compose.yaml", stack: "docker" },
];

const MONOREPO_FINGERPRINTS = [
  { file: "pnpm-workspace.yaml", type: "pnpm" },
  { file: "lerna.json", type: "lerna" },
  { file: "turbo.json", type: "turbo" },
  { file: "nx.json", type: "nx" },
];

// ── Single-directory detection ──

function globExists(dir, pattern) {
  try {
    return fs.readdirSync(dir).some((f) => matchGlob(f, pattern));
  } catch {
    return false;
  }
}

function matchGlob(name, pattern) {
  if (!pattern.includes("*")) return name === pattern;
  const re = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
  return re.test(name);
}

function fingerprintExists(cwd, file) {
  if (file.includes("*")) return globExists(cwd, file);
  return fileExists(path.join(cwd, file));
}

function detectTechStack(cwd) {
  const stacks = [];
  const hasTsconfig = fileExists(path.join(cwd, "tsconfig.json"));

  for (const fp of FINGERPRINTS) {
    if (fp.stack === "typescript" && hasTsconfig) {
      stacks.push(fp);
      continue;
    }
    if (fp.stack === "typescript") continue;
    if (fingerprintExists(cwd, fp.file)) {
      stacks.push(fp);
    }
  }

  if (!hasTsconfig && fileExists(path.join(cwd, "package.json"))) {
    stacks.push({ file: "package.json", stack: "javascript", verify: ["npm test"] });
  }

  return stacks;
}

function detectAuxStacks(cwd) {
  const aux = [];
  for (const fp of AUX_FINGERPRINTS) {
    if (fileExists(path.join(cwd, fp.file))) {
      aux.push(fp.stack);
    }
  }
  return [...new Set(aux)];
}

// ── Command discovery (works for any directory) ──

function discoverCommands(cwd) {
  const discovered = { verify: [], lint: [], build: [] };

  // Makefile
  if (fileExists(path.join(cwd, "Makefile"))) {
    const r = run("make -n test 2>/dev/null", { cwd, timeout: 3000 });
    if (r.ok) discovered.verify.push("make test");
    const lint = run("make -n lint 2>/dev/null", { cwd, timeout: 3000 });
    if (lint.ok) discovered.lint.push("make lint");
  }

  // CI workflows
  const wfDir = path.join(cwd, ".github/workflows");
  if (dirExists(wfDir)) {
    try {
      const files = fs.readdirSync(wfDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
      for (const f of files.slice(0, 3)) {
        const content = fs.readFileSync(path.join(wfDir, f), "utf-8");
        for (const cmd of extractRunCommands(content)) {
          if (/test|check|verify/i.test(cmd) && !discovered.verify.includes(cmd)) {
            discovered.verify.push(cmd);
          } else if (/lint|fmt|eslint|prettier/i.test(cmd) && !discovered.lint.includes(cmd)) {
            discovered.lint.push(cmd);
          }
        }
      }
    } catch {}
  }

  return discovered;
}

function extractRunCommands(yaml) {
  const cmds = [];
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") && trimmed.length > 2) {
      const cmd = trimmed.slice(2).trim();
      if (cmd.startsWith("$") || cmd.startsWith("{{")) continue;
      if (/(npm|yarn|pnpm|go|cargo|mvn|gradle|python|pytest|make|dotnet|bundle|mix|swift|flutter|phpunit)\s/.test(cmd)) {
        cmds.push(cmd);
      }
    }
  }
  return cmds;
}

// ── Monorepo detection ──

function detectMonorepo(cwd) {
  for (const fp of MONOREPO_FINGERPRINTS) {
    if (fileExists(path.join(cwd, fp.file))) {
      return { file: fp.file, type: fp.type };
    }
  }
  const pkg = readPackageJson(cwd);
  if (pkg && pkg.workspaces) {
    return { file: "package.json", type: "npm-workspaces" };
  }
  return null;
}

function readPackageJson(cwd) {
  const p = path.join(cwd, "package.json");
  if (!fileExists(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function getWorkspaceDirs(cwd) {
  const dirs = new Set();

  const pnpmWs = path.join(cwd, "pnpm-workspace.yaml");
  if (fileExists(pnpmWs)) {
    try {
      const content = fs.readFileSync(pnpmWs, "utf-8");
      for (const g of parseYamlPackages(content)) expandGlob(cwd, g, dirs);
    } catch {}
  }

  const pkg = readPackageJson(cwd);
  if (pkg && pkg.workspaces) {
    const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces.packages || []);
    for (const g of ws) expandGlob(cwd, g, dirs);
  }

  const lernaPath = path.join(cwd, "lerna.json");
  if (fileExists(lernaPath)) {
    try {
      const lerna = JSON.parse(fs.readFileSync(lernaPath, "utf-8"));
      for (const g of lerna.packages || ["packages/*"]) expandGlob(cwd, g, dirs);
    } catch {}
  }

  return [...dirs];
}

function parseYamlPackages(content) {
  const globs = [];
  let inPackages = false;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "packages:") { inPackages = true; continue; }
    if (inPackages) {
      if (trimmed.startsWith("- ")) {
        const g = trimmed.slice(2).trim().replace(/['"]/g, "");
        if (g) globs.push(g);
      } else if (trimmed && !trimmed.startsWith("#")) {
        break;
      }
    }
  }
  return globs;
}

function expandGlob(cwd, pattern, dirs) {
  const base = pattern.replace(/\/?\*+$/, "");
  if (!base) return;
  const baseDir = path.join(cwd, base);
  if (!dirExists(baseDir)) return;
  try {
    for (const e of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_")) {
        dirs.add(path.join(base, e.name));
      }
    }
  } catch {}
}

// ── Sub-project analysis ──

const JS_STACKS = new Set(["javascript", "typescript"]);

function analyzeSubProjects(cwd, wsDirs) {
  const subProjects = [];
  for (const dir of wsDirs) {
    const full = path.join(cwd, dir);
    const detected = detectTechStack(full);
    if (detected.length === 0) continue;

    const stacks = detected.map((s) => s.stack);
    const isJs = stacks.some((s) => JS_STACKS.has(s));

    // Try discovery first (Makefile / CI), then fallback to FINGERPRINTS
    const discovered = discoverCommands(full);
    const fingerprintDefaults = detected.flatMap((s) => s.verify || []);

    subProjects.push({
      path: dir,
      stacks,
      isJs,
      verify: discovered.verify.length > 0 ? discovered.verify : fingerprintDefaults,
    });
  }
  return subProjects;
}

// ── Monorepo-wide JS/TS commands ──

function getMonorepoJsCommands(cwd) {
  const pkg = readPackageJson(cwd);
  const hasTest = !!(pkg && pkg.scripts && pkg.scripts.test);
  const hasLint = !!(pkg && pkg.scripts && pkg.scripts.lint);
  const hasBuild = !!(pkg && pkg.scripts && pkg.scripts.build);

  const result = { verify: [], lint: [], build: [] };

  if (fileExists(path.join(cwd, "turbo.json"))) {
    if (hasTest) result.verify.push("turbo run test");
    if (hasLint) result.lint.push("turbo run lint");
    if (hasBuild) result.build.push("turbo run build");
    return result;
  }

  const monorepo = detectMonorepo(cwd);
  switch (monorepo ? monorepo.type : null) {
    case "pnpm":
      if (hasTest) result.verify.push("pnpm -r run test");
      if (hasLint) result.lint.push("pnpm -r run lint");
      if (hasBuild) result.build.push("pnpm -r run build");
      break;
    case "lerna":
      if (hasTest) result.verify.push("npx lerna run test");
      if (hasLint) result.lint.push("npx lerna run lint");
      if (hasBuild) result.build.push("npx lerna run build");
      break;
    case "nx":
      result.verify.push("nx run-many --target=test");
      if (hasLint) result.lint.push("nx run-many --target=lint");
      if (hasBuild) result.build.push("nx run-many --target=build");
      break;
    case "npm-workspaces":
      if (hasTest) result.verify.push("npm run test --workspaces");
      if (hasLint) result.lint.push("npm run lint --workspaces");
      if (hasBuild) result.build.push("npm run build --workspaces");
      break;
  }

  return result;
}

// ── Profile building ──

function buildProfile(cwd) {
  const stacks = detectTechStack(cwd);
  const auxStacks = detectAuxStacks(cwd);
  const discovered = discoverCommands(cwd);
  const monorepo = detectMonorepo(cwd);

  const techStack = [...new Set([...stacks.map((s) => s.stack), ...auxStacks])];
  const files = {};
  for (const s of stacks) files[s.file] = true;
  for (const fp of AUX_FINGERPRINTS) {
    if (fileExists(path.join(cwd, fp.file))) files[fp.file] = true;
  }

  const profile = { version: 1, opencraftVersion: OPENCRAFT_VERSION, techStack, detectedAt: new Date().toISOString().split("T")[0], detectedBy: "opencraft-auto", files };

  if (monorepo) {
    buildMonorepoProfile(cwd, profile, stacks, techStack, files, monorepo);
  } else {
    profile.verify = discovered.verify.length > 0 ? discovered.verify : stacks.flatMap((s) => s.verify || []);
    profile.lint = discovered.lint.length > 0 ? discovered.lint : stacks.flatMap((s) => s.lint || []);
    profile.build = discovered.build.length > 0 ? discovered.build : stacks.flatMap((s) => s.build || []);
  }

  return profile;
}

function buildMonorepoProfile(cwd, profile, rootStacks, techStack, files, monorepo) {
  const wsDirs = getWorkspaceDirs(cwd);
  const subProjects = analyzeSubProjects(cwd, wsDirs);

  // Add sub-project stacks to techStack
  for (const sp of subProjects) {
    for (const s of sp.stacks) {
      if (!techStack.includes(s)) techStack.push(s);
    }
  }

  // Track monorepo fingerprint files
  for (const fp of MONOREPO_FINGERPRINTS) {
    if (fileExists(path.join(cwd, fp.file))) files[fp.file] = true;
  }

  // Every sub-project gets scoped verify commands
  const verify = [];
  const lint = [];
  const build = [];
  for (const sp of subProjects) {
    if (sp.isJs) {
      // JS/TS sub-projects: use per-project tsc/typecheck
      for (const cmd of sp.verify) {
        verify.push(`(cd ${sp.path} && ${cmd})`);
      }
    } else {
      // Non-JS sub-projects: use discovered or fingerprint defaults
      for (const cmd of sp.verify) {
        verify.push(`(cd ${sp.path} && ${cmd})`);
      }
    }
  }

  profile.verify = verify;
  profile.lint = lint;
  profile.build = build;

  // Sub-project details
  profile.monorepo = {
    type: monorepo.type,
    subProjects: subProjects.map((sp) => ({ path: sp.path, stacks: sp.stacks })),
  };

  const tools = [];
  if (fileExists(path.join(cwd, "turbo.json"))) tools.push("turbo");
  if (monorepo.type !== "turbo" && monorepo.type !== "pnpm") tools.push(monorepo.type);
  if (tools.length > 0) profile.monorepo.tools = tools;
}

// ── Profile persistence ──

function opencraftDir(cwd) {
  return path.join(cwd, ".opencraft");
}

function profilePath(cwd) {
  return path.join(cwd, ".opencraft", "profile.json");
}

function loadProfile(cwd) {
  const p = profilePath(cwd);
  if (!fileExists(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function saveProfile(cwd, profile) {
  const dir = opencraftDir(cwd);
  if (!dirExists(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(profilePath(cwd), JSON.stringify(profile, null, 2) + "\n");

  // Migrate legacy profile if it exists
  const legacyPath = path.join(cwd, ".claude", "opencraft-profile.json");
  if (fileExists(legacyPath)) {
    try { fs.unlinkSync(legacyPath); } catch {}
  }
}

function isProfileStale(profile, cwd) {
  if (!profile || !profile.files) return true;
  if (profile.opencraftVersion !== OPENCRAFT_VERSION) return true;
  for (const [file, expected] of Object.entries(profile.files)) {
    const exists = fileExists(path.join(cwd, file));
    if (exists !== expected) return true;
  }
  const currentStacks = detectTechStack(cwd);
  for (const s of currentStacks) {
    if (!profile.files[s.file]) return true;
  }
  for (const fp of MONOREPO_FINGERPRINTS) {
    const exists = fileExists(path.join(cwd, fp.file));
    const tracked = !!profile.files[fp.file];
    if (exists !== tracked) return true;
  }
  return false;
}

// ── Settings env injection ──

const REQUIRED_ENV = {
  CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS: "60000",
};

function ensureSettingsEnv(cwd) {
  const settingsPath = path.join(cwd, ".claude", "settings.json");
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8")); } catch {}
  if (!settings.env) settings.env = {};

  let changed = false;
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    if (!settings.env[key]) {
      settings.env[key] = value;
      changed = true;
    }
  }
  if (changed) {
    const dir = path.dirname(settingsPath);
    if (!dirExists(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  }
}

function getOrCreateProfile(cwd) {
  const existing = loadProfile(cwd);
  if (existing && !isProfileStale(existing, cwd)) {
    return { profile: existing, isNew: false, isStale: false };
  }
  const profile = buildProfile(cwd);
  saveProfile(cwd, profile);
  ensureSettingsEnv(cwd);
  return { profile, isNew: !existing, isStale: !!existing };
}

module.exports = {
  detectTechStack,
  detectMonorepo,
  getWorkspaceDirs,
  analyzeSubProjects,
  discoverCommands,
  buildProfile,
  loadProfile,
  saveProfile,
  isProfileStale,
  getOrCreateProfile,
};
