const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  formatConventionsMd,
  readComment,
  mergeResults,
  applyOverrides,
  countConventions,
} = require("../hooks/lib/convention-engine.cjs");

describe("convention-engine", () => {
  describe("formatConventionsMd", () => {
    it("formats a complete conventions object", () => {
      const result = {
        naming: {
          functions: "camelCase",
          functionPrefixes: ["get", "create"],
          variables: "camelCase",
          constants: "UPPER_SNAKE_CASE",
          classes: "PascalCase",
          files: "kebab-case",
          testFiles: ".test",
          confidence: 85,
        },
        structure: {
          avgFnLength: 18,
          p75: 35,
          p90: 62,
          avgFileLength: 95,
          maxFileLength: 420,
          testDir: "test",
          srcDir: "src",
          exportStyle: "named",
        },
        patterns: {
          errorHandling: "try/catch",
          stateManagement: "Zustand",
          apiCalls: null,
          testing: "Vitest",
          styling: null,
        },
        imports: {
          aliases: [],
          style: "relative",
          barrelExports: false,
        },
      };

      const md = formatConventionsMd(result, "abc1234", "2026-06-06");
      assert.ok(md.includes("# Project Conventions"));
      assert.ok(md.includes("camelCase"));
      assert.ok(md.includes("18 lines"));
      assert.ok(md.includes("try/catch"));
      assert.ok(md.includes("last-commit: abc1234"));
    });

    it("handles sparse data gracefully", () => {
      const result = {
        naming: { functions: null, functionPrefixes: [], variables: null, constants: null, classes: null, files: null, testFiles: null, confidence: 0 },
        structure: { avgFnLength: 0, p75: 0, p90: 0, avgFileLength: 0, maxFileLength: 0, testDir: null, srcDir: null, exportStyle: null },
        patterns: { errorHandling: null, stateManagement: null, apiCalls: null, testing: null, styling: null },
        imports: { aliases: [], style: null, barrelExports: false },
      };
      const md = formatConventionsMd(result, "abc", "2026-06-06");
      assert.ok(md.includes("# Project Conventions"));
      assert.ok(md.includes("last-commit: abc"));
    });
  });

  describe("readComment", () => {
    it("extracts value from HTML comment", () => {
      const content = "<!-- last-commit: abc123 -->\n# Title";
      assert.equal(readComment(content, "last-commit"), "abc123");
    });
    it("returns null for missing comment", () => {
      assert.equal(readComment("no comment here", "last-commit"), null);
    });
    it("extracts scan date from standalone comment", () => {
      const content = "<!-- scan-date: 2026-06-06 -->\n# Title";
      assert.equal(readComment(content, "scan-date"), "2026-06-06");
    });
  });

  describe("mergeResults", () => {
    it("merges scanner results", () => {
      const a = { naming: { functions: "camelCase" } };
      const b = { structure: { avgFnLength: 10 } };
      const merged = mergeResults([a, b]);
      assert.equal(merged.naming.functions, "camelCase");
      assert.equal(merged.structure.avgFnLength, 10);
    });
    it("later results override earlier keys", () => {
      const a = { naming: { functions: "camelCase" } };
      const b = { naming: { functions: "snake_case" } };
      const merged = mergeResults([a, b]);
      assert.equal(merged.naming.functions, "snake_case");
    });
  });

  describe("countConventions", () => {
    it("counts detected conventions", () => {
      const result = {
        naming: { functions: "camelCase", files: "kebab-case", constants: "UPPER_SNAKE_CASE", classes: "PascalCase" },
        patterns: { errorHandling: "try/catch", stateManagement: "Zustand" },
        structure: { avgFnLength: 15 },
        imports: { style: "relative" },
      };
      assert.equal(countConventions(result), 8);
    });
    it("returns 0 for null", () => {
      assert.equal(countConventions(null), 0);
    });
  });

  describe("applyOverrides", () => {
    it("overrides detected naming conventions", () => {
      const result = { naming: { functions: "camelCase", files: "kebab-case" } };
      applyOverrides(result, { conventions: { naming: { functions: "snake_case" } } });
      assert.equal(result.naming.functions, "snake_case");
      assert.equal(result.naming.files, "kebab-case");
    });
    it("excludes a scanner category", () => {
      const result = { naming: { functions: "camelCase" }, patterns: { errorHandling: "try/catch" } };
      applyOverrides(result, { exclude: ["patterns"] });
      assert.equal(result.naming.functions, "camelCase");
      assert.equal(result.patterns, null);
    });
    it("returns result unchanged when overrides is null", () => {
      const result = { naming: { functions: "camelCase" } };
      applyOverrides(result, null);
      assert.equal(result.naming.functions, "camelCase");
    });
  });
});
