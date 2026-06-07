const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { executeRules } = require("../../../hooks/lib/rule-engine.cjs");

function scan(content, filePath = "src/config.js") {
  const slack = require("../../../hooks/lib/rules/secrets/slack.cjs");
  const twilio = require("../../../hooks/lib/rules/secrets/twilio.cjs");
  const sendgrid = require("../../../hooks/lib/rules/secrets/sendgrid.cjs");
  const npm = require("../../../hooks/lib/rules/secrets/npm.cjs");
  const datadog = require("../../../hooks/lib/rules/secrets/datadog.cjs");
  const sentry = require("../../../hooks/lib/rules/secrets/sentry.cjs");
  const db = require("../../../hooks/lib/rules/secrets/database.cjs");
  const pk = require("../../../hooks/lib/rules/secrets/private-key.cjs");
  const jwt = require("../../../hooks/lib/rules/secrets/jwt.cjs");
  const openai = require("../../../hooks/lib/rules/secrets/openai.cjs");
  const generic = require("../../../hooks/lib/rules/secrets/generic.cjs");
  const pypi = require("../../../hooks/lib/rules/secrets/pypi.cjs");
  const rules = [...slack, ...twilio, ...sendgrid, ...npm, ...datadog, ...sentry, ...db, ...pk, ...jwt, ...openai, ...generic, ...pypi];
  return executeRules(rules, { content, filePath });
}

describe("remaining secret rules", () => {
  it("detects Slack bot token (xoxb-)", () => {
    const r = scan("xox" + "b-1234567890-1234567890-abcdefghijklmnopqrstuvwx");
    assert.ok(r.findings.some(f => f.ruleId === "slack-bot-token"));
  });

  it("detects Twilio API key", () => {
    // Use mixed hex chars to pass entropy=3 threshold
    const r = scan("S" + "K0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d");
    assert.ok(r.findings.some(f => f.ruleId === "twilio-api-key"));
  });

  it("detects SendGrid API token", () => {
    // Use mixed chars to pass entropy=2 threshold
    const r = scan("SG.A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6A7b8C9d0E1f2G3h4I5j6K7l8M9n0O1p2Q3r4");
    assert.ok(r.findings.some(f => f.ruleId === "sendgrid-api-token"));
  });

  it("detects npm access token", () => {
    // Use mixed chars to pass entropy=2 threshold
    const r = scan("npm_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8");
    assert.ok(r.findings.some(f => f.ruleId === "npm-access-token"));
  });

  it("detects MongoDB URI", () => {
    const r = scan("mongodb+srv://user:pass@cluster.mongodb.net/db");
    assert.ok(r.findings.some(f => f.ruleId === "mongodb-uri"));
  });

  it("detects PostgreSQL URI", () => {
    const r = scan("postgresql://user:password@host:5432/dbname");
    assert.ok(r.findings.some(f => f.ruleId === "postgres-uri"));
  });

  it("detects RSA private key (multiline)", () => {
    // Need 64+ chars between BEGIN and END markers to satisfy regex
    const keyBody = "MIIBogIBAAJBAKx1M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6A7b8C9d0E1f2G3h4I5j6K7l8";
    const content = "some\n-----BEGIN RSA PRIVATE KEY-----\n" + keyBody + "\n-----END RSA PRIVATE KEY-----\nmore";
    const r = scan(content, "key.pem");
    assert.ok(r.findings.some(f => f.ruleId === "private-key"));
  });

  it("detects JWT token", () => {
    const r = scan("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456");
    assert.ok(r.findings.some(f => f.ruleId === "jwt-token"));
  });

  it("detects OpenAI key (sk-)", () => {
    const key = "sk-A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5";
    const r = scan(key);
    assert.ok(r.findings.some(f => f.ruleId === "openai-key"));
  });

  it("detects OpenAI project key (sk-proj-)", () => {
    const key = "sk-proj-A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5";
    const r = scan(key);
    assert.ok(r.findings.some(f => f.ruleId === "openai-project-key"));
  });

  it("detects PyPI token", () => {
    // Use mixed chars to pass entropy=3 threshold
    const r = scan("pypi-AgEIcHb" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6A7b8C9d0E1f2G3h4I5j6K7l8M9n0O1p2Q3r4S5t6U7v8W9x0");
    assert.ok(r.findings.some(f => f.ruleId === "pypi-token"));
  });

  it("returns empty for clean content", () => {
    const r = scan("const x = 1;");
    assert.equal(r.findings.length, 0);
  });
});
