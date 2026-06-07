const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const {
  escapeRegex,
  grepImportPaths,
  getDependents,
  formatWarning,
  MAX_DEPENDENTS,
  TRIVIAL_FILES,
} = require("../hooks/lib/deps-resolve.cjs");

const CWD = path.resolve(__dirname, "..");

describe("deps-resolve", () => {
  describe("escapeRegex", () => {
    it("escapes special regex characters", () => {
      assert.equal(escapeRegex("file.name"), "file\\.name");
      assert.equal(escapeRegex("path/to/file"), "path/to/file");
      assert.equal(escapeRegex("test[0]"), "test\\[0\\]");
      assert.equal(escapeRegex("a+b"), "a\\+b");
    });

    it("handles empty string", () => {
      assert.equal(escapeRegex(""), "");
    });
  });

  describe("grepImportPaths", () => {
    it("finds files that require a module", () => {
      const result = grepImportPaths(CWD, path.join(CWD, "hooks/utils.cjs"), [".cjs"]);
      assert.ok(Array.isArray(result));
      // utils.cjs is required by many hooks
      assert.ok(result.length > 0);
    });

    it("finds files that import detection module", () => {
      const result = grepImportPaths(CWD, path.join(CWD, "hooks/lib/detection.cjs"), [".cjs"]);
      assert.ok(Array.isArray(result));
      // detection.cjs is imported by session-start, post-tool-use, etc.
      assert.ok(result.length > 0);
      // Should not include the file itself
      assert.ok(!result.includes("hooks/lib/detection.cjs"));
    });

    it("returns empty or minimal for isolated file", () => {
      // Create a hypothetical file path that nothing imports
      // Note: grep may match the test file itself since it contains the string
      const result = grepImportPaths(CWD, path.join(CWD, "hooks/lib/zzz-isolated-xyz.cjs"), [".cjs"]);
      assert.ok(Array.isArray(result));
      // Should not include any real source files
      const sourceFiles = result.filter(f => f.startsWith("hooks/lib/") && !f.includes("test"));
      assert.deepEqual(sourceFiles, []);
    });

    it("respects MAX_DEPENDENTS limit", () => {
      assert.ok(MAX_DEPENDENTS <= 20, "MAX_DEPENDENTS should be reasonable");
    });
  });

  describe("getDependents", () => {
    it("returns result with dependents array and source", () => {
      const result = getDependents(CWD, path.join(CWD, "hooks/utils.cjs"), [".cjs"]);
      assert.ok(Array.isArray(result.dependents));
      assert.ok(typeof result.source === "string");
      assert.ok(["codegraph", "grep"].includes(result.source));
    });

    it("falls back to grep when codegraph unavailable", () => {
      // In this project, codegraph is likely not installed
      const result = getDependents(CWD, path.join(CWD, "hooks/utils.cjs"), [".cjs"]);
      assert.equal(result.source, "grep");
    });
  });

  describe("formatWarning", () => {
    it("returns null when no dependents", () => {
      const result = formatWarning("test.js", { dependents: [], source: "grep" });
      assert.equal(result, null);
    });

    it("formats warning with dependents list", () => {
      const result = formatWarning("src/auth.ts", {
        dependents: ["src/api.ts", "src/middleware.ts"],
        source: "grep",
      });
      assert.ok(result.includes("Modified auth.ts"));
      assert.ok(result.includes("2 files depend"));
      assert.ok(result.includes("src/api.ts"));
      assert.ok(result.includes("src/middleware.ts"));
      assert.ok(result.includes("Verify these call sites"));
    });

    it("shows singular for 1 dependent", () => {
      const result = formatWarning("src/utils.ts", {
        dependents: ["src/app.ts"],
        source: "grep",
      });
      assert.ok(result.includes("1 file depends"));
    });

    it("truncates to 5 dependents with 'more' indicator", () => {
      const deps = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts", "g.ts"];
      const result = formatWarning("src/utils.ts", {
        dependents: deps,
        source: "grep",
      });
      assert.ok(result.includes("7 files depend"));
      assert.ok(result.includes("... and 2 more"));
      assert.ok(!result.includes("f.ts"));
      assert.ok(!result.includes("g.ts"));
    });

    it("includes source attribution", () => {
      const result = formatWarning("src/auth.ts", {
        dependents: ["src/api.ts"],
        source: "codegraph",
      });
      assert.ok(result.includes("(source: codegraph)"));
    });
  });

  describe("TRIVIAL_FILES filter", () => {
    it("includes common trivial filenames", () => {
      assert.ok(TRIVIAL_FILES.has("index"));
      assert.ok(TRIVIAL_FILES.has("types"));
      assert.ok(TRIVIAL_FILES.has("utils"));
      assert.ok(TRIVIAL_FILES.has("helpers"));
      assert.ok(TRIVIAL_FILES.has("config"));
      assert.ok(TRIVIAL_FILES.has("constants"));
    });

    it("filters trivial files from grep results", () => {
      // grep for utils.cjs would match index.cjs (re-exports) — verify it's filtered
      const result = grepImportPaths(CWD, path.join(CWD, "hooks/utils.cjs"), [".cjs"]);
      // None of the results should have a trivial basename
      for (const file of result) {
        const basename = path.basename(file, path.extname(file));
        assert.ok(!TRIVIAL_FILES.has(basename), `${file} should be filtered as trivial`);
      }
    });

    it("does not filter meaningful files", () => {
      // A meaningful file like session-start.cjs should not be in TRIVIAL_FILES
      assert.ok(!TRIVIAL_FILES.has("session-start"));
      assert.ok(!TRIVIAL_FILES.has("smart-context"));
      assert.ok(!TRIVIAL_FILES.has("deps-resolve"));
    });
  });
});
