// hooks/lib/ensure-global-config.cjs
// Seeds the global ~/.opencraft/disabled-rules.json from the shipped default
// template, but only when it does not already exist. Idempotent and
// non-destructive: an existing global file (user-edited) is left untouched.
//
// This is the ONLY place that *writes* the global disabled-rules file.
// rule-engine.cjs only ever *reads* it — keeping load-time logic free of any
// hardcoded rule ids.
const fs = require("fs");
const path = require("path");

function globalConfigPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;
  return path.join(home, ".opencraft", "disabled-rules.json");
}

/**
 * Ensure ~/.opencraft/disabled-rules.json exists, seeding it from the shipped
 * default template on first run.
 * @returns {{ created: boolean, path: string|null }}
 */
function ensureGlobalDisabledRules() {
  const target = globalConfigPath();
  if (!target) return { created: false, path: null };

  if (fs.existsSync(target)) return { created: false, path: target };

  let defaults;
  try {
    defaults = JSON.parse(
      fs.readFileSync(path.join(__dirname, "default-disabled-rules.json"), "utf-8")
    );
  } catch {
    return { created: false, path: target };
  }

  const payload = {
    _comment:
      "Globally disabled opencraft rule ids. Rule files remain on disk; listed ids are skipped at load time across all projects. Remove an id to re-enable that rule. Seeded from opencraft defaults on first run.",
    disabledRules: Array.isArray(defaults.disabledRules) ? defaults.disabledRules : [],
  };

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(payload, null, 2) + "\n");
    return { created: true, path: target };
  } catch {
    return { created: false, path: target };
  }
}

module.exports = { ensureGlobalDisabledRules, globalConfigPath };
