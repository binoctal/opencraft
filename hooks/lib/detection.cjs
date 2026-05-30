const fs = require("fs");
const path = require("path");
const { fileExists, dirExists, run } = require("../utils.cjs");

const FINGERPRINTS = [
  { file: "go.mod", stack: "go", verify: ["go vet ./...", "go test ./..."], build: ["go build ./..."] },
  { file: "tsconfig.json", stack: "typescript", verify: ["npx tsc --noEmit"] },
  { file: "pyproject.toml", stack: "python", verify: ["pytest"] },
  { file: "setup.py", stack: "python", verify: ["pytest"] },
  { file: "Cargo.toml", stack: "rust", verify: ["cargo check", "cargo test"] },
  { file: "pom.xml", stack: "java", verify: ["mvn test"] },
  { file: "build.gradle", stack: "java", verify: ["gradle test"] },
];

const AUX_FINGERPRINTS = [
  { file: "Dockerfile", stack: "docker" },
  { file: "docker-compose.yml", stack: "docker" },
  { file: "docker-compose.yaml", stack: "docker" },
];

function detectTechStack(cwd) {
  const stacks = [];
  const hasTsconfig = fileExists(path.join(cwd, "tsconfig.json"));

  for (const fp of FINGERPRINTS) {
    if (fp.stack === "typescript" && hasTsconfig) {
      stacks.push(fp);
      continue;
    }
    if (fp.stack === "typescript") continue;
    if (fileExists(path.join(cwd, fp.file))) {
      stacks.push(fp);
    }
  }

  // JavaScript: package.json without tsconfig
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
      if (/(npm|yarn|pnpm|go|cargo|mvn|gradle|python|pytest|make)\s/.test(cmd)) {
        cmds.push(cmd);
      }
    }
  }
  return cmds;
}

function buildProfile(cwd) {
  const stacks = detectTechStack(cwd);
  const auxStacks = detectAuxStacks(cwd);
  const discovered = discoverCommands(cwd);

  const techStack = [...new Set([...stacks.map((s) => s.stack), ...auxStacks])];
  const verify = discovered.verify.length > 0
    ? discovered.verify
    : stacks.flatMap((s) => s.verify || []);
  const lint = discovered.lint.length > 0 ? discovered.lint : stacks.flatMap((s) => s.lint || []);
  const build = discovered.build.length > 0 ? discovered.build : stacks.flatMap((s) => s.build || []);

  const files = {};
  for (const s of stacks) files[s.file] = true;
  for (const fp of AUX_FINGERPRINTS) {
    if (fileExists(path.join(cwd, fp.file))) files[fp.file] = true;
  }

  return {
    version: 1,
    techStack,
    verify,
    lint,
    build,
    detectedAt: new Date().toISOString().split("T")[0],
    detectedBy: "opencraft-auto",
    files,
  };
}

function profilePath(cwd) {
  return path.join(cwd, ".claude", "opencraft-profile.json");
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
  const dir = path.join(cwd, ".claude");
  if (!dirExists(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(profilePath(cwd), JSON.stringify(profile, null, 2) + "\n");
}

function isProfileStale(profile, cwd) {
  if (!profile || !profile.files) return true;
  for (const [file, expected] of Object.entries(profile.files)) {
    const exists = fileExists(path.join(cwd, file));
    if (exists !== expected) return true;
  }
  // Check if new fingerprint files appeared
  const currentStacks = detectTechStack(cwd);
  for (const s of currentStacks) {
    if (!profile.files[s.file]) return true;
  }
  return false;
}

function getOrCreateProfile(cwd) {
  const existing = loadProfile(cwd);
  if (existing && !isProfileStale(existing, cwd)) {
    return { profile: existing, isNew: false, isStale: false };
  }
  const profile = buildProfile(cwd);
  saveProfile(cwd, profile);
  return { profile, isNew: !existing, isStale: !!existing };
}

module.exports = {
  detectTechStack,
  discoverCommands,
  buildProfile,
  loadProfile,
  saveProfile,
  isProfileStale,
  getOrCreateProfile,
};
