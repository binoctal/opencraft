const fs = require("fs");
const path = require("path");
const { fileExists, dirExists } = require("../utils.cjs");

/**
 * Normalize a command for comparison.
 * Strips npx/npm run/pnpm run/yarn prefixes to get the base command.
 */
function normalize(cmd) {
  return cmd
    .replace(/^(npx|npm run|pnpm run|pnpm|yarn run|yarn)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract commands from CI workflow files.
 * Returns { verify: [...], lint: [...], build: [...] }.
 */
function extractCICommands(cwd) {
  const result = { verify: [], lint: [], build: [] };
  const wfDir = path.join(cwd, ".github", "workflows");

  if (!dirExists(wfDir)) return result;

  try {
    const files = fs
      .readdirSync(wfDir)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

    for (const f of files.slice(0, 5)) {
      const content = fs.readFileSync(path.join(wfDir, f), "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("- ") || trimmed.length <= 2) continue;

        const cmd = trimmed.slice(2).trim();
        if (cmd.startsWith("$") || cmd.startsWith("{{")) continue;

        // Categorize
        if (/(npm|yarn|pnpm|turbo|nx)\s+(run\s+)?(test|check|verify|typecheck)/i.test(cmd)) {
          if (!result.verify.includes(cmd)) result.verify.push(cmd);
        } else if (/(eslint|prettier|lint|fmt| biome)/i.test(cmd)) {
          if (!result.lint.includes(cmd)) result.lint.push(cmd);
        } else if (/(npm|yarn|pnpm|turbo|nx)\s+(run\s+)?build/i.test(cmd)) {
          if (!result.build.includes(cmd)) result.build.push(cmd);
        } else if (/(go|cargo|mvn|gradle|pytest|make|dotnet|bundle|mix|swift|flutter|phpunit)\s/.test(cmd)) {
          if (/test|check|verify/i.test(cmd) && !result.verify.includes(cmd)) {
            result.verify.push(cmd);
          }
        }
      }
    }
  } catch {}

  return result;
}

/**
 * Compare CI commands against profile commands.
 * Returns array of mismatches.
 */
function checkAlignment(cwd, profile) {
  const ci = extractCICommands(cwd);
  const mismatches = [];

  for (const category of ["verify", "lint", "build"]) {
    const ciCmds = ci[category] || [];
    const profileCmds = profile[category] || [];

    if (ciCmds.length === 0) continue;

    const profileNormalized = new Set(profileCmds.map(normalize));

    for (const cmd of ciCmds) {
      const norm = normalize(cmd);
      if (!profileNormalized.has(norm) && !profileNormalized.has(cmd)) {
        // Check if profile has a semantically similar command
        const hasSimilar = profileCmds.some((p) => {
          const pn = normalize(p);
          // Same base command (e.g., both end with "test")
          return pn === norm || pn.endsWith(norm) || norm.endsWith(pn);
        });

        if (!hasSimilar) {
          mismatches.push({
            category,
            ci: cmd,
            profile: profileCmds.length > 0 ? profileCmds : ["(none)"],
          });
        }
      }
    }
  }

  return mismatches;
}

module.exports = { checkAlignment, extractCICommands, normalize };
