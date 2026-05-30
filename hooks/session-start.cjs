const path = require("path");
const { countLines, fileExists } = require("./utils.cjs");
const { getOrCreateProfile } = require("./lib/detection.cjs");
const { detectAdapters } = require("./adapters/index.cjs");

const TAG = "opencraft";

function buildContext(cwd, profile, adapters) {
  const lines = [];

  // Project Status section
  lines.push("## Project Status");
  lines.push(`Tech: ${profile.techStack.join(", ")}`);
  if (profile.verify.length > 0) lines.push(`Verify: ${profile.verify.join(", ")}`);
  if (profile.lint.length > 0) lines.push(`Lint: ${profile.lint.join(", ")}`);
  if (profile.build.length > 0) lines.push(`Build: ${profile.build.join(", ")}`);

  // Active work from adapters
  for (const adapter of adapters) {
    const work = adapter.getActiveWork(cwd);
    if (work.activeWork.length > 0) {
      lines.push(`Active work: ${work.status.details.join(", ")}`);
    }
  }

  // CLAUDE.md health
  const claudeMdPath = path.join(cwd, ".claude", "CLAUDE.md");
  const linesCount = countLines(claudeMdPath);
  if (linesCount > 0) {
    const icon = linesCount <= 80 ? "✅" : "⚠️";
    lines.push(`CLAUDE.md: ${linesCount} lines ${icon}`);
  } else {
    lines.push("CLAUDE.md: not found ⚠️");
  }

  lines.push("");

  // Governance Rules section
  lines.push("## Governance Rules");
  lines.push("- Verify before claiming done");
  lines.push("- Commit quality checks run automatically");
  lines.push("- CLAUDE.md should stay under 80 lines");
  lines.push("");
  lines.push("Adjust: /opencraft:setup");

  return lines.join("\n");
}

function main() {
  const cwd = process.cwd();

  try {
    const { profile, isNew, isStale } = getOrCreateProfile(cwd);
    const adapters = detectAdapters(cwd);
    const context = buildContext(cwd, profile, adapters);

    // Level 1 messages
    const messages = [];
    if (isNew) {
      messages.push(`[opencraft] ${profile.techStack.join(" + ")} | governance profile generated | /opencraft:setup to adjust`);
    } else if (isStale) {
      messages.push(`[opencraft] 🔄 tech stack changed, governance profile updated`);
    } else {
      const changesCount = adapters.reduce((n, a) => n + a.getActiveWork(cwd).activeWork.length, 0);
      const claudeMdLines = countLines(path.join(cwd, ".claude", "CLAUDE.md"));
      messages.push(`[opencraft] ✅ ${profile.techStack.join(" + ")} | ${changesCount} change${changesCount !== 1 ? "s" : ""} | ${claudeMdLines}-line CLAUDE.md`);
    }

    const output = {
      additionalContext: `<opencraft-context>\n${context}\n</opencraft-context>`,
    };

    if (messages.length > 0) {
      output.message = messages.join("\n");
      output.systemMessage = messages.join("\n");
    }

    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  } catch (e) {
    // Timeout protection: output what we have
    process.stdout.write(JSON.stringify({
      message: `[opencraft] ⚠️ session start hook error: ${e.message}`,
    }));
    process.exit(0);
  }
}

main();
