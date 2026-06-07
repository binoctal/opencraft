// hooks/pre-tool-use.cjs — thin dispatcher via rule engine
const fs = require("fs");
const path = require("path");
const { readToolInput } = require("./utils.cjs");
const { loadRules, matchRules, executeRules } = require("./lib/rule-engine.cjs");

function isActivatedProject(cwd) {
  return fs.existsSync(path.join(cwd, ".opencraft", "profile.json"));
}

function main() {
  const cwd = process.cwd();
  if (!isActivatedProject(cwd)) process.exit(0);

  const input = readToolInput();
  const toolName = input.tool_name || "";
  const cmd = input.tool_input?.command || "";

  // Resolve trigger event
  let trigger;
  if (toolName === "Write" || toolName === "Edit") {
    trigger = "Write|Edit";
  } else if (/git\s+push/.test(cmd)) {
    trigger = "Bash(git push origin main)";
  } else if (/git\s+commit/.test(cmd)) {
    trigger = "Bash(git commit -m msg)";
  } else {
    process.exit(0);
  }

  const allRules = loadRules(cwd);
  const rules = matchRules(trigger, allRules);
  if (rules.length === 0) process.exit(0);

  // Build context for rule execution
  let context;
  if (toolName === "Write" || toolName === "Edit") {
    const filePath = input.tool_input?.file_path || "";
    const content = input.tool_input?.content || input.tool_input?.new_string || "";
    context = { content, filePath, input, cwd };
  } else {
    context = { input, cwd };
  }

  const result = executeRules(rules, context);

  if (result.blocked || result.findings?.length > 0) {
    const messages = [];
    if (result.findings?.length > 0) {
      const lines = result.findings.map(f =>
        `  - ${f.name} (${f.severity}) at line ${f.line}: ${f.preview}`
      );
      messages.push(
        `[opencraft] potential secrets detected in ${context.filePath}:\n${lines.join("\n")}\nIf this is intentional, you can override.`
      );
    }
    if (result.messages?.length > 0) {
      messages.push(...result.messages);
    }
    if (messages.length > 0) {
      process.stdout.write(JSON.stringify({ message: messages.join("\n\n") }));
    }
    process.exit(result.blocked ? 1 : 0);
  }
  process.exit(0);
}

main();
