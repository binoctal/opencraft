const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { executeRules } = require("../../../hooks/lib/rule-engine.cjs");

function scan(content, filePath = "src/config.js") {
  const aws = require("../../../hooks/lib/rules/secrets/aws.cjs");
  const gcp = require("../../../hooks/lib/rules/secrets/gcp.cjs");
  const azure = require("../../../hooks/lib/rules/secrets/azure.cjs");
  const cf = require("../../../hooks/lib/rules/secrets/cloudflare.cjs");
  const rules = [...aws, ...gcp, ...azure, ...cf];
  return executeRules(rules, { content, filePath });
}

describe("cloud secret rules", () => {
  it("detects AWS access key (AKIA)", () => {
    const r = scan("AKIAABCDEFGHJKLMNPQR");
    assert.ok(r.findings.some(f => f.ruleId === "aws-access-token"));
  });

  it("skips AWS key ending in EXAMPLE", () => {
    const r = scan("AKIAABCDEFGHJKLEXAMPLE");
    assert.ok(!r.findings.some(f => f.ruleId === "aws-access-token"));
  });

  it("detects GCP API key (AIza)", () => {
    const key = "AIzaaBcDeFgHiJkLmNoPqRsTuVwXyZ012345678";
    const r = scan(key);
    assert.ok(r.findings.some(f => f.ruleId === "gcp-api-key"));
  });

  it("skips GCP Firebase example keys", () => {
    const r = scan("AIzaSyAnLA7NfeLquW1tJFpx_eQCxoX-oo6YyIs");
    assert.ok(!r.findings.some(f => f.ruleId === "gcp-api-key"));
  });

  it("detects Cloudflare origin CA key", () => {
    const key = "v1.0-" + "a1b2c3d4e5f6a7b8c9d0e1f2".slice(0, 24) + "-" + ("abcdef0123456789".repeat(10)).slice(0, 146);
    const r = scan(key);
    assert.ok(r.findings.some(f => f.ruleId === "cloudflare-origin-ca-key"));
  });

  it("detects Azure AD client secret", () => {
    const key = "abc1Q~" + "aBcDeFgHiJkLmNoPqRsTuVwXyZ01234";
    const r = scan('password="' + key + '"');
    assert.ok(r.findings.some(f => f.ruleId === "azure-ad-client-secret"));
  });

  it("returns empty for clean content", () => {
    const r = scan("const x = 1;");
    assert.equal(r.findings.length, 0);
  });
});
