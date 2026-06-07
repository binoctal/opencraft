// hooks/post-tool-use.cjs — thin dispatcher via rule engine
const fs = require("fs");
const path = require("path");
const { readToolInput } = require("./utils.cjs");
const { getOrCreateProfile } = require("./lib/detection.cjs");
const { loadRules, matchRules, executeRules } = require("./lib/rule-engine.cjs");

function isActivatedProject(cwd) {
  return fs.existsSync(path.join(cwd, ".opencraft", "profile.json"));
}

function main() {
  const cwd = process.cwd();
  if (!isActivatedProject(cwd)) process.exit(0);

  // Profile freshness check
  const { profile: freshProfile, isStale } = getOrCreateProfile(cwd);
  if (isStale) {
    const msg = `[opencraft] 🔄 governance profile updated to v${freshProfile.opencraftVersion}`;
    process.stdout.write(JSON.stringify({ systemMessage: msg }));
    console.error(msg);
  }

  const input = readToolInput();
  const toolName = input.tool_name || "";
  const cmd = input.tool_input?.command || "";

  // Resolve trigger and build context
  let trigger;
  let context;

  if (toolName === "Write" || toolName === "Edit") {
    trigger = "Write|Edit";
    const filePath = input.tool_input?.file_path || "";
    const content = input.tool_input?.content || input.tool_input?.new_string || "";
    context = { content, filePath, input, cwd };
  } else if (/git\s+push/.test(cmd)) {
    trigger = "Bash(git push origin main)";
    context = { input, cwd };
  } else {
    // Non-push Bash: check quality rules only
    const allRules = loadRules(cwd);
    const qualityRules = allRules.filter(r => r.type === "quality");
    if (qualityRules.length > 0) {
      const result = executeRules(qualityRules, { input, cwd });
      if (result.messages?.length > 0) {
        process.stdout.write(JSON.stringify({ systemMessage: result.messages.join("\n") }));
      }
    }
    process.exit(0);
  }

  const allRules = loadRules(cwd);
  const rules = matchRules(trigger, allRules);
  if (rules.length === 0) process.exit(0);

  const result = executeRules(rules, context);

  if (result.messages?.length > 0) {
    process.stdout.write(JSON.stringify({ systemMessage: result.messages.join("\n\n") }));
  }

  process.exit(0);
}

main();
