const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { mock } = require("node:test");
const { withMockedRun } = require("./helpers/mock-utils.cjs");

const todoPath = require.resolve("../hooks/lib/todo-scan.cjs");

describe("todo-scan", () => {
  describe("scanRecentTodos", () => {
    it("returns empty array when no files provided", () => {
      delete require.cache[todoPath];
      const { scanRecentTodos } = require(todoPath);
      assert.deepEqual(scanRecentTodos("/fake", []), []);
    });

    it("returns empty array when files array is null", () => {
      delete require.cache[todoPath];
      const { scanRecentTodos } = require(todoPath);
      assert.deepEqual(scanRecentTodos("/fake", null), []);
    });

    it("finds TODO items", () => {
      const tmp = path.join(os.tmpdir(), `oc-todo-${Date.now()}.js`);
      fs.writeFileSync(tmp, "const x = 1;\n// TODO: fix this\nconst y = 2;\n");

      delete require.cache[todoPath];
      const { scanRecentTodos } = require(todoPath);
      const result = scanRecentTodos(os.tmpdir(), [path.basename(tmp)]);
      assert.equal(result.length, 1);
      assert.equal(result[0].type, "TODO");
      assert.equal(result[0].line, 2);
      fs.unlinkSync(tmp);
    });

    it("finds FIXME items", () => {
      const tmp = path.join(os.tmpdir(), `oc-fixme-${Date.now()}.js`);
      fs.writeFileSync(tmp, "// FIXME: broken logic\n");

      delete require.cache[todoPath];
      const { scanRecentTodos } = require(todoPath);
      const result = scanRecentTodos(os.tmpdir(), [path.basename(tmp)]);
      assert.equal(result.length, 1);
      assert.equal(result[0].type, "FIXME");
      fs.unlinkSync(tmp);
    });

    it("finds HACK items", () => {
      const tmp = path.join(os.tmpdir(), `oc-hack-${Date.now()}.js`);
      fs.writeFileSync(tmp, "// HACK: temporary workaround\n");

      delete require.cache[todoPath];
      const { scanRecentTodos } = require(todoPath);
      const result = scanRecentTodos(os.tmpdir(), [path.basename(tmp)]);
      assert.equal(result.length, 1);
      assert.equal(result[0].type, "HACK");
      fs.unlinkSync(tmp);
    });

    it("reports correct file path and line number", () => {
      const fname = `oc-test-${Date.now()}.js`;
      const tmp = path.join(os.tmpdir(), fname);
      fs.writeFileSync(tmp, "a\nb\n// TODO: here\nc\n");

      delete require.cache[todoPath];
      const { scanRecentTodos } = require(todoPath);
      const result = scanRecentTodos(os.tmpdir(), [fname]);
      assert.equal(result[0].file, fname);
      assert.equal(result[0].line, 3);
      fs.unlinkSync(tmp);
    });

    it("truncates text to 60 chars", () => {
      const fname = `oc-trunc-${Date.now()}.js`;
      const tmp = path.join(os.tmpdir(), fname);
      const longTodo = "// TODO: " + "x".repeat(80);
      fs.writeFileSync(tmp, longTodo + "\n");

      delete require.cache[todoPath];
      const { scanRecentTodos } = require(todoPath);
      const result = scanRecentTodos(os.tmpdir(), [fname]);
      assert.ok(result[0].text.length <= 60);
      fs.unlinkSync(tmp);
    });

    it("handles file read errors gracefully", () => {
      delete require.cache[todoPath];
      const { scanRecentTodos } = require(todoPath);
      const result = scanRecentTodos("/fake", ["nonexistent.js"]);
      assert.deepEqual(result, []);
    });

    it("limits results to 10 items", () => {
      const fname = `oc-limit-${Date.now()}.js`;
      const tmp = path.join(os.tmpdir(), fname);
      const lines = Array.from({ length: 15 }, (_, i) => `// TODO: item ${i}`);
      fs.writeFileSync(tmp, lines.join("\n") + "\n");

      delete require.cache[todoPath];
      const { scanRecentTodos } = require(todoPath);
      const result = scanRecentTodos(os.tmpdir(), [fname]);
      assert.equal(result.length, 10);
      fs.unlinkSync(tmp);
    });
  });

  describe("getChangedAndRecentFiles", () => {
    it("combines working tree and untracked files", () => {
      const mod = withMockedRun({
        "git diff --name-only HEAD": { ok: true, stdout: "a.js\nb.js" },
        "git ls-files --others": { ok: true, stdout: "c.js" },
        "git diff --name-only HEAD~5": { ok: true, stdout: "" },
      }, todoPath);
      const result = mod.getChangedAndRecentFiles("/fake");
      assert.deepEqual(result.sort(), ["a.js", "b.js", "c.js"].sort());
    });

    it("deduplicates across sources", () => {
      const mod = withMockedRun({
        "git diff --name-only HEAD": { ok: true, stdout: "a.js" },
        "git ls-files --others": { ok: true, stdout: "a.js" },
        "git diff --name-only HEAD~5": { ok: true, stdout: "a.js" },
      }, todoPath);
      const result = mod.getChangedAndRecentFiles("/fake");
      assert.deepEqual(result, ["a.js"]);
    });

    it("returns empty array when all git commands fail", () => {
      const mod = withMockedRun({}, todoPath);
      const result = mod.getChangedAndRecentFiles("/fake");
      assert.deepEqual(result, []);
    });
  });
});
