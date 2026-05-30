const path = require("path");
const { run, dirExists } = require("./utils.cjs");
const { detectAdapters } = require("./adapters/index.cjs");

function main() {
  const cwd = process.cwd();
  const reminders = [];

  // Check for uncommitted changes
  const diffResult = run("git diff --name-only", { cwd, timeout: 3000 });
  const cachedResult = run("git diff --cached --name-only", { cwd, timeout: 3000 });

  const hasUnstaged = diffResult.ok && diffResult.stdout.trim().length > 0;
  const hasStaged = cachedResult.ok && cachedResult.stdout.trim().length > 0;

  if (hasUnstaged || hasStaged) {
    reminders.push("You have uncommitted changes that have not been verified. Consider running /opencraft:verify before ending.");
  }

  // Check for active openspec changes
  const adapters = detectAdapters(cwd);
  for (const adapter of adapters) {
    if (adapter.name === "openspec") {
      const work = adapter.getActiveWork(cwd);
      if (work.activeWork.length > 0) {
        reminders.push(`Active change${work.activeWork.length > 1 ? "s" : ""}: ${work.status.details.join(", ")}. Consider updating tasks.md if you made progress.`);
      }
    }
  }

  if (reminders.length > 0) {
    process.stdout.write(JSON.stringify({
      systemMessage: `[opencraft] ${reminders.join(" | ")}`,
    }));
  }

  process.exit(0);
}

main();
