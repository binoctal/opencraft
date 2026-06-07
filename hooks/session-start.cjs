const fs = require("fs");
const path = require("path");
const { getOrCreateProfile } = require("./lib/detection.cjs");

const { runScan, countConventions } = require("./lib/convention-engine.cjs");

/**
 * Guard: only run for projects that have been explicitly activated.
 * Checks for .opencraft/profile.json as activation marker.
 */
function isActivatedProject(cwd) {
  return fs.existsSync(path.join(cwd, ".opencraft", "profile.json"));
}

function buildIndexLine(profile, conventionCount, decisionCount, ruleCount) {
  const stack = (profile.techStack || []).join("/");
  const parts = [];
  if (stack) parts.push(stack);
  if (conventionCount > 0) parts.push(`${conventionCount} conventions`);
  if (decisionCount > 0) parts.push(`${decisionCount} decisions`);
  if (ruleCount > 0) parts.push(`${ruleCount} rules`);
  return `[opencraft] ${parts.join(" | ")}\nUse opencraft:context for full project details`;
}

function main() {
  const cwd = process.cwd();
  if (!isActivatedProject(cwd)) process.exit(0);

  try {
    const { profile, isNew } = getOrCreateProfile(cwd);

    // Run convention scan for caching (don't inject output)
    try { runScan(cwd); } catch {}

    // Count conventions (countConventions imported from convention-engine)
    let conventionCount = 0;
    try { conventionCount = countConventions(cwd); } catch {}

    // Count decisions from knowledge store
    let decisionCount = 0;
    try {
      const { readKnowledgeFile } = require("./lib/knowledge.cjs");
      decisionCount = readKnowledgeFile(cwd, "decisions").length;
    } catch {}

    // Count user rules in .opencraft/rules/
    let ruleCount = 0;
    try {
      const userRulesDir = path.join(cwd, ".opencraft", "rules");
      if (fs.existsSync(userRulesDir)) {
        const entries = fs.readdirSync(userRulesDir, { recursive: true });
        ruleCount = entries.filter(e => typeof e === "string" && e.endsWith(".cjs")).length;
      }
    } catch {}

    const message = isNew
      ? `[opencraft] ${profile.techStack.join(" + ")} | governance profile generated | /opencraft:setup to adjust`
      : buildIndexLine(profile, conventionCount, decisionCount, ruleCount);

    process.stdout.write(JSON.stringify({ systemMessage: message }));
    process.exit(0);
  } catch (e) {
    process.stdout.write(JSON.stringify({
      message: `[opencraft] session start hook error: ${e.message}`,
    }));
    process.exit(0);
  }
}

module.exports = { buildIndexLine };

if (require.main === module) main();
