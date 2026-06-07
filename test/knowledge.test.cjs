const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { hasCccmemory, writeKnowledgeFile, readKnowledgeFile } = require("../hooks/lib/knowledge.cjs");

describe("knowledge", () => {
  describe("hasCccmemory", () => {
    it("returns false when no cccmemory DB exists", () => {
      assert.equal(hasCccmemory(["/nonexistent/path/db"]), false);
    });

    it("returns true when a DB path exists", () => {
      const tmpDb = path.join(os.tmpdir(), "fake-cccmemory.db");
      fs.writeFileSync(tmpDb, "fake");
      assert.equal(hasCccmemory([tmpDb]), true);
      fs.unlinkSync(tmpDb);
    });
  });

  describe("writeKnowledgeFile + readKnowledgeFile", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencraft-test-"));
      fs.mkdirSync(path.join(tmpDir, ".opencraft"), { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates knowledge.md when writing first entry", () => {
      writeKnowledgeFile(tmpDir, {
        type: "preferences",
        key: "always-zod",
        value: "Use zod for all runtime validation",
      });
      const filePath = path.join(tmpDir, ".opencraft", "knowledge.md");
      assert.ok(fs.existsSync(filePath));
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(content.includes("## Preferences"));
      assert.ok(content.includes("always-zod"));
      assert.ok(content.includes("Use zod for all runtime validation"));
    });

    it("reads entries by type", () => {
      writeKnowledgeFile(tmpDir, {
        type: "preferences",
        key: "always-zod",
        value: "Use zod for all runtime validation",
      });
      writeKnowledgeFile(tmpDir, {
        type: "patterns",
        key: "error-handling",
        value: "Always wrap external calls in try/catch",
      });
      const prefs = readKnowledgeFile(tmpDir, "preferences");
      assert.equal(prefs.length, 1);
      assert.equal(prefs[0].key, "always-zod");
      const patterns = readKnowledgeFile(tmpDir, "patterns");
      assert.equal(patterns.length, 1);
      assert.equal(patterns[0].key, "error-handling");
    });

    it("updates existing entry with same key", () => {
      writeKnowledgeFile(tmpDir, {
        type: "preferences",
        key: "test-pref",
        value: "old value",
      });
      writeKnowledgeFile(tmpDir, {
        type: "preferences",
        key: "test-pref",
        value: "new value",
      });
      const prefs = readKnowledgeFile(tmpDir, "preferences");
      const entry = prefs.find(p => p.key === "test-pref");
      assert.ok(entry);
      assert.equal(entry.value, "new value");
    });

    it("returns empty array for missing type section", () => {
      const gotchas = readKnowledgeFile(tmpDir, "gotchas");
      assert.equal(gotchas.length, 0);
    });

    it("handles all four types", () => {
      const types = ["preferences", "patterns", "decisions", "gotchas"];
      for (const type of types) {
        writeKnowledgeFile(tmpDir, {
          type,
          key: `${type}-test`,
          value: `${type} test value`,
        });
      }
      for (const type of types) {
        const entries = readKnowledgeFile(tmpDir, type);
        assert.equal(entries.length, 1, `expected 1 entry for ${type}`);
      }
    });

    it("handles keys with regex metacharacters", () => {
      const trickyKey = "config.json (v2.0+)";
      writeKnowledgeFile(tmpDir, {
        type: "decisions",
        key: trickyKey,
        value: "use this config",
      });
      // Write again to test upsert doesn't duplicate
      writeKnowledgeFile(tmpDir, {
        type: "decisions",
        key: trickyKey,
        value: "use that config",
      });
      const entries = readKnowledgeFile(tmpDir, "decisions");
      assert.equal(entries.length, 1);
      assert.equal(entries[0].key, trickyKey);
      assert.equal(entries[0].value, "use that config");
    });

    it("reads entries with empty values", () => {
      writeKnowledgeFile(tmpDir, {
        type: "gotchas",
        key: "blank-entry",
        value: "",
      });
      const entries = readKnowledgeFile(tmpDir, "gotchas");
      assert.equal(entries.length, 1);
      assert.equal(entries[0].key, "blank-entry");
      assert.equal(entries[0].value, "");
    });
  });

  describe("knowledge scope operations", () => {
    let projectDir;
    let globalDir;

    beforeEach(() => {
      projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencraft-proj-"));
      globalDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencraft-global-"));
      fs.mkdirSync(path.join(projectDir, ".opencraft"), { recursive: true });
      fs.mkdirSync(path.join(globalDir, ".opencraft"), { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.rmSync(globalDir, { recursive: true, force: true });
    });

    it("readAll merges project and global entries with scope", () => {
      const { writeKnowledgeFile, readAll } = require("../hooks/lib/knowledge.cjs");
      writeKnowledgeFile(projectDir, { type: "preferences", key: "proj-pref", value: "project level" });
      writeKnowledgeFile(globalDir, { type: "preferences", key: "global-pref", value: "global level" });

      const entries = readAll(projectDir, globalDir);
      assert.equal(entries.length, 2);
      const proj = entries.find(e => e.key === "proj-pref");
      const glob = entries.find(e => e.key === "global-pref");
      assert.ok(proj);
      assert.equal(proj.scope, "project");
      assert.ok(glob);
      assert.equal(glob.scope, "global");
    });

    it("promote moves entry from project to global", () => {
      const { writeKnowledgeFile, readKnowledgeFile, promote } = require("../hooks/lib/knowledge.cjs");
      writeKnowledgeFile(projectDir, { type: "patterns", key: "my-pattern", value: "project pattern" });

      promote(projectDir, globalDir, "my-pattern");

      const projEntries = readKnowledgeFile(projectDir, "patterns");
      assert.equal(projEntries.length, 0);
      const globEntries = readKnowledgeFile(globalDir, "patterns");
      assert.equal(globEntries.length, 1);
      assert.equal(globEntries[0].key, "my-pattern");
      assert.equal(globEntries[0].value, "project pattern");
    });

    it("demote moves entry from global to project", () => {
      const { writeKnowledgeFile, readKnowledgeFile, demote } = require("../hooks/lib/knowledge.cjs");
      writeKnowledgeFile(globalDir, { type: "decisions", key: "global-dec", value: "global decision" });

      demote(projectDir, globalDir, "global-dec");

      const globEntries = readKnowledgeFile(globalDir, "decisions");
      assert.equal(globEntries.length, 0);
      const projEntries = readKnowledgeFile(projectDir, "decisions");
      assert.equal(projEntries.length, 1);
      assert.equal(projEntries[0].key, "global-dec");
      assert.equal(projEntries[0].value, "global decision");
    });

    it("deleteEntry removes from project scope", () => {
      const { writeKnowledgeFile, readKnowledgeFile, deleteEntry } = require("../hooks/lib/knowledge.cjs");
      writeKnowledgeFile(projectDir, { type: "gotchas", key: "bad-env", value: "utf8 only" });

      deleteEntry(projectDir, globalDir, "bad-env", "project");

      const entries = readKnowledgeFile(projectDir, "gotchas");
      assert.equal(entries.length, 0);
    });

    it("deleteEntry removes from global scope", () => {
      const { writeKnowledgeFile, readKnowledgeFile, deleteEntry } = require("../hooks/lib/knowledge.cjs");
      writeKnowledgeFile(globalDir, { type: "preferences", key: "global-pref", value: "global one" });

      deleteEntry(projectDir, globalDir, "global-pref", "global");

      const entries = readKnowledgeFile(globalDir, "preferences");
      assert.equal(entries.length, 0);
    });

    it("editEntry updates value in project scope", () => {
      const { writeKnowledgeFile, readKnowledgeFile, editEntry } = require("../hooks/lib/knowledge.cjs");
      writeKnowledgeFile(projectDir, { type: "preferences", key: "my-pref", value: "old value" });

      editEntry(projectDir, globalDir, "my-pref", "project", "new value");

      const entries = readKnowledgeFile(projectDir, "preferences");
      assert.equal(entries.length, 1);
      assert.equal(entries[0].value, "new value");
    });

    it("editEntry updates value in global scope", () => {
      const { writeKnowledgeFile, readKnowledgeFile, editEntry } = require("../hooks/lib/knowledge.cjs");
      writeKnowledgeFile(globalDir, { type: "patterns", key: "gl-pattern", value: "old pattern" });

      editEntry(projectDir, globalDir, "gl-pattern", "global", "new pattern");

      const entries = readKnowledgeFile(globalDir, "patterns");
      assert.equal(entries.length, 1);
      assert.equal(entries[0].value, "new pattern");
    });

    it("promote is no-op when key not found", () => {
      const { promote, readKnowledgeFile } = require("../hooks/lib/knowledge.cjs");

      promote(projectDir, globalDir, "nonexistent");

      const projEntries = readKnowledgeFile(projectDir, "preferences");
      assert.equal(projEntries.length, 0);
      const globEntries = readKnowledgeFile(globalDir, "preferences");
      assert.equal(globEntries.length, 0);
    });

    it("readAll returns empty when no files exist", () => {
      const { readAll } = require("../hooks/lib/knowledge.cjs");
      const entries = readAll(projectDir, globalDir);
      assert.equal(entries.length, 0);
    });

    it("demote is no-op when key not found", () => {
      const { demote, readKnowledgeFile } = require("../hooks/lib/knowledge.cjs");

      demote(projectDir, globalDir, "nonexistent");

      const projEntries = readKnowledgeFile(projectDir, "decisions");
      assert.equal(projEntries.length, 0);
      const globEntries = readKnowledgeFile(globalDir, "decisions");
      assert.equal(globEntries.length, 0);
    });
  });
});
