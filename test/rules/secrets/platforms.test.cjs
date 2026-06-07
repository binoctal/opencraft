const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { executeRules } = require("../../../hooks/lib/rule-engine.cjs");

function scan(content, filePath = "src/config.js") {
  const github = require("../../../hooks/lib/rules/secrets/github.cjs");
  const gitlab = require("../../../hooks/lib/rules/secrets/gitlab.cjs");
  const stripe = require("../../../hooks/lib/rules/secrets/stripe.cjs");
  const anthropic = require("../../../hooks/lib/rules/secrets/anthropic.cjs");
  const rules = [...github, ...gitlab, ...stripe, ...anthropic];
  return executeRules(rules, { content, filePath });
}

describe("platform secret rules", () => {
  it("detects GitHub PAT (ghp_)", () => {
    const r = scan("ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8");
    assert.ok(r.findings.some(f => f.ruleId === "github-pat"));
  });

  it("detects GitHub fine-grained PAT (github_pat_)", () => {
    const r = scan("github_pat_" + "A1b2C3d4E5f6G7h8I9j0A1b2C3d4E5f6G7h8I9j0A1b2C3d4E5f6G7h8I9j0A1b2C3d4E5f6G7h8I9j0XY");
    assert.ok(r.findings.some(f => f.ruleId === "github-fine-grained-pat"));
  });

  it("detects GitHub OAuth (gho_)", () => {
    const r = scan("gho_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8");
    assert.ok(r.findings.some(f => f.ruleId === "github-oauth"));
  });

  it("detects GitHub refresh token (ghr_)", () => {
    const r = scan("ghr_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8");
    assert.ok(r.findings.some(f => f.ruleId === "github-refresh-token"));
  });

  it("detects GitLab PAT (glpat-)", () => {
    const r = scan("glpat-" + "A1b2C3d4E5f6G7h8I9j0");
    assert.ok(r.findings.some(f => f.ruleId === "gitlab-pat"));
  });

  it("detects Stripe live key", () => {
    const r = scan("sk_live_" + "A1b2C3d4E5f6G7h8I9j0K1l2");
    assert.ok(r.findings.some(f => f.ruleId === "stripe-access-token"));
  });

  it("detects Stripe test key", () => {
    const r = scan("sk_test_" + "A1b2C3d4E5f6G7h8I9j0K1l2");
    assert.ok(r.findings.some(f => f.ruleId === "stripe-access-token"));
  });

  it("detects Anthropic API key", () => {
    const key = "sk-ant-api03-" + "a".repeat(93) + "AA";
    const r = scan(key);
    assert.ok(r.findings.some(f => f.ruleId === "anthropic-api-key"));
  });

  it("detects Anthropic admin key", () => {
    const key = "sk-ant-admin01-" + "a".repeat(93) + "AA";
    const r = scan(key);
    assert.ok(r.findings.some(f => f.ruleId === "anthropic-admin-api-key"));
  });

  it("skips Anthropic key with wrong suffix", () => {
    const key = "sk-ant-api03-" + "a".repeat(93) + "BB";
    const r = scan(key);
    assert.ok(!r.findings.some(f => f.ruleId === "anthropic-api-key"));
  });

  it("returns empty for clean content", () => {
    const r = scan("const token = process.env.GITHUB_TOKEN;");
    assert.equal(r.findings.length, 0);
  });
});
