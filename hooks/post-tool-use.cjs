const { run } = require("./utils.cjs");
const { loadProfile } = require("./lib/detection.cjs");

function main() {
  const cwd = process.cwd();
  const profile = loadProfile(cwd);

  // No profile → silent skip
  if (!profile || !profile.verify || profile.verify.length === 0) {
    process.exit(0);
  }

  let failed = false;

  for (const cmd of profile.verify) {
    const result = run(cmd, { cwd, timeout: 120_000 });

    if (!result.ok) {
      // Command not found → skip (not a failure)
      if (result.code === 127 || /not found|command not found|ENOENT/i.test(result.stderr)) {
        continue;
      }

      console.error(`[opencraft] ✗ ${cmd} failed (exit ${result.code})`);
      if (result.stderr) {
        const lines = result.stderr.split("\n").slice(0, 15).join("\n");
        console.error(lines);
      }
      if (result.stdout) {
        const lines = result.stdout.split("\n").slice(0, 10).join("\n");
        console.error(lines);
      }
      failed = true;
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
