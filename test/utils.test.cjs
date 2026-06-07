const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { mock } = require("node:test");

const utilsPath = require.resolve("../hooks/utils.cjs");

describe("utils", () => {
  describe("run()", () => {
    let run;
    beforeEach(() => { delete require.cache[utilsPath]; ({ run } = require(utilsPath)); });

    it("returns ok:true for successful command", () => {
      const r = run("echo hello");
      assert.equal(r.ok, true);
      assert.equal(r.stdout, "hello");
      assert.equal(r.code, 0);
    });

    it("returns ok:false for failing command", () => {
      const r = run("exit 1");
      assert.equal(r.ok, false);
    });

    it("never throws even for invalid commands", () => {
      assert.doesNotThrow(() => run("nonexistent_command_xyz_12345"));
    });

    it("trims stdout whitespace", () => {
      const r = run("echo '  hello  '");
      assert.equal(r.stdout, "hello");
    });

    it("passes cwd option", () => {
      const r = run("pwd", { cwd: os.tmpdir() });
      assert.ok(r.stdout === os.tmpdir() || r.stdout.includes(path.basename(os.tmpdir())));
    });
  });

  describe("fileExists / dirExists", () => {
    let fileExists, dirExists;
    beforeEach(() => { delete require.cache[utilsPath]; ({ fileExists, dirExists } = require(utilsPath)); });

    it("fileExists returns true for existing file", () => {
      assert.equal(fileExists(utilsPath), true);
    });

    it("fileExists returns false for non-existent path", () => {
      assert.equal(fileExists("/nonexistent/path/file.txt"), false);
    });

    it("fileExists returns false for a directory", () => {
      assert.equal(fileExists(path.dirname(utilsPath)), false);
    });

    it("dirExists returns true for existing directory", () => {
      assert.equal(dirExists(path.dirname(utilsPath)), true);
    });

    it("dirExists returns false for non-existent path", () => {
      assert.equal(dirExists("/nonexistent/path/"), false);
    });

    it("dirExists returns false for a file", () => {
      assert.equal(dirExists(utilsPath), false);
    });
  });

  describe("countLines", () => {
    let countLines;
    beforeEach(() => { delete require.cache[utilsPath]; ({ countLines } = require(utilsPath)); });

    it("returns correct line count", () => {
      const tmp = path.join(os.tmpdir(), `oc-test-${Date.now()}.txt`);
      fs.writeFileSync(tmp, "a\nb\nc\n");
      assert.equal(countLines(tmp), 4);
      fs.unlinkSync(tmp);
    });

    it("returns 0 for non-existent file", () => {
      assert.equal(countLines("/nonexistent/file.txt"), 0);
    });
  });

  describe("pass / warn / fail", () => {
    it("pass prints [tag] with checkmark", () => {
      const logs = [];
      const restore = mock.method(console, "log", (...args) => logs.push(args.join(" ")));
      delete require.cache[utilsPath];
      const { pass } = require(utilsPath);
      pass("oc", "all good");
      restore();
      assert.ok(logs[0].includes("[oc]"));
      assert.ok(logs[0].includes("all good"));
    });
  });

  describe("pluginPath", () => {
    it("resolves relative to CLAUDE_PLUGIN_ROOT", () => {
      delete require.cache[utilsPath];
      process.env.CLAUDE_PLUGIN_ROOT = "/custom/root";
      const { pluginPath } = require(utilsPath);
      assert.equal(pluginPath("hooks", "test.cjs"), "/custom/root/hooks/test.cjs");
      delete process.env.CLAUDE_PLUGIN_ROOT;
    });

    it("falls back to __dirname/.. when env var unset", () => {
      delete require.cache[utilsPath];
      delete process.env.CLAUDE_PLUGIN_ROOT;
      const { pluginPath } = require(utilsPath);
      assert.ok(pluginPath("hooks").includes("hooks"));
    });
  });
});
