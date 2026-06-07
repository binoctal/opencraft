const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

describe("rule-engine", () => {
  describe("shannonEntropy", () => {
    const { shannonEntropy } = require("../hooks/lib/rule-engine.cjs");

    it("returns 0 for empty string", () => {
      assert.equal(shannonEntropy(""), 0);
    });

    it("returns 0 for null/undefined", () => {
      assert.equal(shannonEntropy(null), 0);
      assert.equal(shannonEntropy(undefined), 0);
    });

    it("returns 0 for single repeated character", () => {
      assert.equal(shannonEntropy("aaaa"), 0);
    });

    it("returns ~1 for two equal-probability characters", () => {
      const e = shannonEntropy("ab");
      assert.ok(Math.abs(e - 1) < 0.01, `expected ~1, got ${e}`);
    });

    it("returns higher entropy for random-ish strings", () => {
      const e = shannonEntropy("aB3xY9kL7pQ2mN");
      assert.ok(e > 3, `expected >3, got ${e}`);
    });

    it("returns ~4.7 for 24-char alphanumeric", () => {
      const e = shannonEntropy("aB3xY9kL7pQ2mN4zR8vC1tW");
      assert.ok(e > 4, `expected >4, got ${e}`);
    });

    it("returns max entropy for fully diverse string", () => {
      const e = shannonEntropy("abcdefgh");
      assert.ok(Math.abs(e - 3) < 0.01, `expected ~3, got ${e}`);
    });
  });

  describe("DEFAULT_TRIGGERS", () => {
    const { DEFAULT_TRIGGERS } = require("../hooks/lib/rule-engine.cjs");

    it("maps secret type to Write|Edit", () => {
      assert.equal(DEFAULT_TRIGGERS.secret, "Write|Edit");
    });

    it("maps branch type to Bash(git push*)", () => {
      assert.equal(DEFAULT_TRIGGERS.branch, "Bash(git push*)");
    });

    it("maps commit type to Bash(git commit*)", () => {
      assert.equal(DEFAULT_TRIGGERS.commit, "Bash(git commit*)");
    });
  });

  describe("loadRules", () => {
    const { loadRules, clearCache } = require("../hooks/lib/rule-engine.cjs");

    afterEach(() => clearCache());

    it("loads built-in rules from hooks/lib/rules/**/*.cjs", () => {
      const rules = loadRules("/fake/path");
      assert.ok(Array.isArray(rules));
    });

    it("caches rules and does not reload on second call", () => {
      const first = loadRules("/fake/path");
      const second = loadRules("/fake/path");
      assert.equal(first, second);
    });

    it("clearCache forces reload", () => {
      const first = loadRules("/fake/path");
      clearCache();
      const second = loadRules("/fake/path");
      assert.notEqual(first, second);
    });
  });

  describe("matchRules", () => {
    const { matchRules } = require("../hooks/lib/rule-engine.cjs");

    it("matches rules by trigger pipe-separated pattern", () => {
      const rules = [
        { id: "a", type: "secret", trigger: "Write|Edit" },
        { id: "b", type: "branch", trigger: "Bash(git push*)" },
      ];
      const matched = matchRules("Write|Edit", rules);
      assert.equal(matched.length, 1);
      assert.equal(matched[0].id, "a");
    });

    it("uses DEFAULT_TRIGGERS when rule has no trigger field", () => {
      const { DEFAULT_TRIGGERS, matchRules } = require("../hooks/lib/rule-engine.cjs");
      const rules = [
        { id: "a", type: "secret" },
      ];
      const matched = matchRules("Write|Edit", rules);
      assert.equal(matched.length, 1);
    });

    it("returns empty array when no rules match", () => {
      const rules = [
        { id: "a", type: "branch", trigger: "Bash(git push*)" },
      ];
      const matched = matchRules("Write|Edit", rules);
      assert.equal(matched.length, 0);
    });

    it("matches Bash trigger with command glob", () => {
      const rules = [
        { id: "a", type: "branch", trigger: "Bash(git push*)" },
      ];
      const matched = matchRules("Bash(git push origin main)", rules);
      assert.equal(matched.length, 1);
    });
  });

  describe("executeRules — secret type", () => {
    const { executeRules } = require("../hooks/lib/rule-engine.cjs");

    it("detects secret with regex and keywords", () => {
      const rules = [{
        id: "test-key", name: "Test Key", type: "secret", severity: "critical",
        keywords: ["tk_"], regex: /tk_[a-zA-Z0-9]{20}/, entropy: 0, multiline: false, allowlist: [],
      }];
      const content = 'const x = "tk_abcdefghijklmnopqrst"';
      const result = executeRules(rules, { content, filePath: "src/config.js" });
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].ruleId, "test-key");
      assert.equal(result.findings[0].line, 1);
    });

    it("skips line when no keyword matches", () => {
      const rules = [{
        id: "test-key", name: "Test Key", type: "secret", severity: "critical",
        keywords: ["tk_"], regex: /tk_[a-zA-Z0-9]{20}/, entropy: 0, multiline: false, allowlist: [],
      }];
      const content = 'const x = "no_keyword_here"';
      const result = executeRules(rules, { content, filePath: "src/config.js" });
      assert.equal(result.findings.length, 0);
    });

    it("runs regex on every line when keywords is empty", () => {
      const rules = [{
        id: "test-key", name: "Test Key", type: "secret", severity: "critical",
        keywords: [], regex: /-----BEGIN PRIVATE KEY-----/, entropy: 0, multiline: false, allowlist: [],
      }];
      const content = "line1\n-----BEGIN PRIVATE KEY-----\nline3";
      const result = executeRules(rules, { content, filePath: "key.pem" });
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].line, 2);
    });

    it("filters by entropy threshold", () => {
      const rules = [{
        id: "test-key", name: "Test Key", type: "secret", severity: "critical",
        keywords: ["tk_"], regex: /tk_[a-zA-Z0-9]{10}/, entropy: 3.0, multiline: false, allowlist: [],
      }];
      const content = 'const x = "tk_aaaaaaaaaa"';
      const result = executeRules(rules, { content, filePath: "src/config.js" });
      assert.equal(result.findings.length, 0);
    });

    it("skips file-level excluded paths", () => {
      const rules = [{
        id: "test-key", name: "Test Key", type: "secret", severity: "critical",
        keywords: ["tk_"], regex: /tk_[a-zA-Z0-9]{20}/, entropy: 0, multiline: false, allowlist: [],
      }];
      const content = 'const x = "tk_abcdefghijklmnopqrst"';
      const result = executeRules(rules, { content, filePath: ".env.example" });
      assert.equal(result.findings.length, 0);
    });

    it("skips allowlisted patterns", () => {
      const rules = [{
        id: "test-key", name: "Test Key", type: "secret", severity: "critical",
        keywords: ["tk_"], regex: /tk_[a-zA-Z0-9]{20}/, entropy: 0, multiline: false, allowlist: [/tk_\*{4,}/],
      }];
      const content = 'const x = "tk_****abcdefghijklmnop"';
      const result = executeRules(rules, { content, filePath: "src/config.js" });
      assert.equal(result.findings.length, 0);
    });

    it("skips lines with whitelist words (test, example, mock, etc.)", () => {
      const rules = [{
        id: "test-key", name: "Test Key", type: "secret", severity: "critical",
        keywords: ["tk_"], regex: /tk_[a-zA-Z0-9]{20}/, entropy: 0, multiline: false, allowlist: [],
      }];
      const content = 'const x = "tk_abcdefghijklmnopqrst"; // test secret';
      const result = executeRules(rules, { content, filePath: "src/config.js" });
      assert.equal(result.findings.length, 0);
    });
  });

  describe("executeRules — check type", () => {
    const { executeRules } = require("../hooks/lib/rule-engine.cjs");

    it("calls check function and returns blocked result", () => {
      const rules = [{
        id: "test-branch", name: "Test Branch", type: "branch", severity: "critical",
        check: (ctx) => ({ blocked: true, message: "blocked!" }),
      }];
      const result = executeRules(rules, { input: {}, cwd: "/tmp" });
      assert.equal(result.blocked, true);
      assert.deepEqual(result.messages, ["blocked!"]);
    });

    it("returns not blocked when check returns blocked: false", () => {
      const rules = [{
        id: "test-branch", name: "Test Branch", type: "branch", severity: "critical",
        check: () => ({ blocked: false }),
      }];
      const result = executeRules(rules, { input: {}, cwd: "/tmp" });
      assert.equal(result.blocked, false);
    });

    it("treats check error as not blocked", () => {
      const rules = [{
        id: "test-error", name: "Test Error", type: "branch", severity: "critical",
        check: () => { throw new Error("boom"); },
      }];
      const result = executeRules(rules, { input: {}, cwd: "/tmp" });
      assert.equal(result.blocked, false);
      assert.equal(result.messages.length, 0);
    });
  });

  describe("executeRules — multiline", () => {
    const { executeRules } = require("../hooks/lib/rule-engine.cjs");

    it("matches multiline rules against full content", () => {
      const rules = [{
        id: "private-key", name: "Private Key", type: "secret", severity: "critical",
        keywords: ["-----BEGIN"], multiline: true,
        regex: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/,
        entropy: 0, allowlist: [],
      }];
      const content = "some text\n-----BEGIN RSA PRIVATE KEY-----\nMIIBog\n-----END RSA PRIVATE KEY-----\nmore text";
      const result = executeRules(rules, { content, filePath: "key.pem" });
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].line, 2);
    });
  });
});
