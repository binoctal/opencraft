const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyCase, isExcludedDir, isExcluded,
  discoverFiles, parseSimpleYaml,
  EXTENSIONS_BY_STACK,
} = require("../hooks/lib/scan-utils.cjs");

describe("scan-utils", () => {
  describe("classifyCase", () => {
    it("classifies camelCase", () => {
      assert.equal(classifyCase("getUser"), "camelCase");
      assert.equal(classifyCase("handleSubmit"), "camelCase");
    });
    it("classifies PascalCase", () => {
      assert.equal(classifyCase("UserProfile"), "PascalCase");
      assert.equal(classifyCase("AuthService"), "PascalCase");
    });
    it("classifies UPPER_SNAKE", () => {
      assert.equal(classifyCase("MAX_RETRY_COUNT"), "UPPER_SNAKE");
      assert.equal(classifyCase("API_BASE_URL"), "UPPER_SNAKE");
    });
    it("classifies snake_case", () => {
      assert.equal(classifyCase("get_user"), "snake_case");
      assert.equal(classifyCase("handle_request"), "snake_case");
    });
    it("classifies kebab-case", () => {
      assert.equal(classifyCase("user-profile"), "kebab-case");
      assert.equal(classifyCase("auth-service"), "kebab-case");
    });
    it("returns null for ambiguous or edge cases", () => {
      assert.equal(classifyCase("x"), "camelCase"); // single char is valid camelCase
      assert.equal(classifyCase(""), null);
      assert.equal(classifyCase("ABC123"), "PascalCase"); // matches uppercase start + alphanum
      assert.equal(classifyCase(null), null);
      assert.equal(classifyCase("mixed-Case_name"), null); // mixed separators
    });
  });

  describe("isExcludedDir", () => {
    it("excludes known directories", () => {
      assert.equal(isExcludedDir("node_modules"), true);
      assert.equal(isExcludedDir(".git"), true);
      assert.equal(isExcludedDir("dist"), true);
      assert.equal(isExcludedDir("build"), true);
    });
    it("does not exclude source directories", () => {
      assert.equal(isExcludedDir("src"), false);
      assert.equal(isExcludedDir("lib"), false);
      assert.equal(isExcludedDir("test"), false);
    });
  });

  describe("isExcluded", () => {
    it("excludes files in EXCLUDE_DIRS", () => {
      assert.equal(isExcluded("node_modules/pkg/index.js", []), true);
      assert.equal(isExcluded("dist/bundle.js", []), true);
    });
    it("does not exclude source files", () => {
      assert.equal(isExcluded("src/index.ts", []), false);
      assert.equal(isExcluded("lib/utils.js", []), false);
    });
    it("excludes files matching gitignore patterns", () => {
      assert.equal(isExcluded("coverage/lcov.info", ["coverage/"]), true);
      assert.equal(isExcluded("debug.log", ["*.log"]), true);
    });
  });

  describe("discoverFiles", () => {
    it("finds files matching extensions in the project", () => {
      const files = discoverFiles(process.cwd(), [".cjs"]);
      assert.ok(files.length > 0);
      assert.ok(files.some(f => f.endsWith(".cjs")));
    });
    it("excludes node_modules and other excluded dirs", () => {
      const files = discoverFiles(process.cwd(), [".cjs"]);
      assert.ok(!files.some(f => f.includes("node_modules")));
      assert.ok(!files.some(f => f.includes(".git")));
    });
  });

  describe("parseSimpleYaml", () => {
    it("parses flat key-value pairs", () => {
      const result = parseSimpleYaml("name: test\nversion: 1");
      assert.equal(result.name, "test");
      assert.equal(result.version, "1");
    });
    it("parses nested keys", () => {
      const yaml = "conventions:\n  naming:\n    style: camelCase";
      const result = parseSimpleYaml(yaml);
      assert.deepEqual(result.conventions.naming.style, "camelCase");
    });
    it("parses inline arrays", () => {
      const yaml = "prefixes: [get, create, update]";
      const result = parseSimpleYaml(yaml);
      assert.deepEqual(result.prefixes, ["get", "create", "update"]);
    });
    it("parses list arrays", () => {
      const yaml = "exclude:\n  - quality-baseline\n  - architecture-guard";
      const result = parseSimpleYaml(yaml);
      assert.deepEqual(result.exclude, ["quality-baseline", "architecture-guard"]);
    });
    it("ignores comments and blank lines", () => {
      const yaml = "# comment\n\nkey: value";
      const result = parseSimpleYaml(yaml);
      assert.equal(result.key, "value");
      assert.equal(Object.keys(result).length, 1);
    });
  });

  describe("EXTENSIONS_BY_STACK", () => {
    it("maps typescript to .ts/.tsx", () => {
      assert.deepEqual(EXTENSIONS_BY_STACK.typescript, [".ts", ".tsx"]);
    });
    it("maps python to .py", () => {
      assert.deepEqual(EXTENSIONS_BY_STACK.python, [".py"]);
    });
    it("maps javascript to .js/.cjs", () => {
      assert.ok(EXTENSIONS_BY_STACK.javascript.includes(".js"));
      assert.ok(EXTENSIONS_BY_STACK.javascript.includes(".cjs"));
    });
  });
});
