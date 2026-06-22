const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("node:os");
const path = require("path");

const { ensureGlobalDisabledRules } = require("../hooks/lib/ensure-global-config.cjs");

describe("ensure-global-config", () => {
  let tmpHome;
  let origHome;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "oc-home-"));
    origHome = process.env.HOME;
    process.env.HOME = tmpHome;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch {}
  });

  it("creates the global file from defaults on first run", () => {
    const res = ensureGlobalDisabledRules();
    assert.equal(res.created, true);
    const data = JSON.parse(fs.readFileSync(res.path, "utf-8"));
    assert.ok(data.disabledRules.includes("no-push-main"));
    assert.ok(data.disabledRules.includes("no-force-push"));
    assert.ok(data.disabledRules.includes("require-feature-branch"));
  });

  it("does not overwrite an existing user-edited file", () => {
    const target = path.join(tmpHome, ".opencraft", "disabled-rules.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ disabledRules: ["custom-rule"] }));

    const res = ensureGlobalDisabledRules();
    assert.equal(res.created, false);
    const data = JSON.parse(fs.readFileSync(target, "utf-8"));
    assert.deepEqual(data.disabledRules, ["custom-rule"]);
  });
});
