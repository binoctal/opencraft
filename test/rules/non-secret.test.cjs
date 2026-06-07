const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { executeRules } = require("../../hooks/lib/rule-engine.cjs");

describe("non-secret rules", () => {
  describe("branch rules", () => {
    const noPushMain = require("../../hooks/lib/rules/branch/no-push-main.cjs");
    const noForcePush = require("../../hooks/lib/rules/branch/no-force-push.cjs");

    it("blocks push to main", () => {
      const result = executeRules([...noPushMain], {
        input: { tool_input: { command: "git push origin main" } },
        cwd: process.cwd(),
      });
      assert.equal(result.blocked, true);
    });

    it("allows push to feature branch", () => {
      const result = executeRules([...noPushMain], {
        input: { tool_input: { command: "git push origin feat/x" } },
        cwd: process.cwd(),
      });
      assert.equal(result.blocked, false);
    });

    it("blocks force push", () => {
      const result = executeRules([...noForcePush], {
        input: { tool_input: { command: "git push --force origin feat/x" } },
        cwd: process.cwd(),
      });
      assert.equal(result.blocked, true);
    });

    it("allows normal push", () => {
      const result = executeRules([...noForcePush], {
        input: { tool_input: { command: "git push origin feat/x" } },
        cwd: process.cwd(),
      });
      assert.equal(result.blocked, false);
    });
  });

  describe("deps rules", () => {
    const depsChanged = require("../../hooks/lib/rules/deps/deps-changed.cjs");

    it("flags dependency file change", () => {
      const result = executeRules([...depsChanged], {
        input: { tool_name: "Write", tool_input: { file_path: "/tmp/project/package.json", content: "{}" } },
        cwd: "/tmp/project",
      });
      assert.equal(result.messages.length, 1);
      assert.ok(result.messages[0].includes("package.json"));
    });

    it("ignores non-dependency file", () => {
      const result = executeRules([...depsChanged], {
        input: { tool_name: "Write", tool_input: { file_path: "/tmp/project/src/index.js", content: "" } },
        cwd: "/tmp/project",
      });
      assert.equal(result.messages.length, 0);
    });
  });
});
