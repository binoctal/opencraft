const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { scan } = require("../hooks/lib/scanners/naming.cjs");

describe("naming scanner", () => {
  it("detects camelCase function names", () => {
    const files = [
      { relPath: "src/user.ts", content: "function getUser() {}\nfunction createUser() {}", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.naming.functions, "camelCase");
  });

  it("detects snake_case function names", () => {
    const files = [
      { relPath: "src/app.py", content: "def get_user():\n    pass\ndef create_user():\n    pass", ext: ".py" },
    ];
    const result = scan(files);
    assert.equal(result.naming.functions, "snake_case");
  });

  it("detects PascalCase class names", () => {
    const files = [
      { relPath: "src/models.ts", content: "class UserService {}\nclass AuthHandler {}", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.naming.classes, "PascalCase");
  });

  it("detects UPPER_SNAKE constants", () => {
    const files = [
      { relPath: "src/config.ts", content: "const MAX_RETRIES = 3;\nconst API_BASE_URL = 'http://localhost';", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.naming.constants, "UPPER_SNAKE_CASE");
  });

  it("detects kebab-case file names", () => {
    const files = [
      { relPath: "src/user-profile.ts", content: "export const x = 1;", ext: ".ts" },
      { relPath: "src/auth-handler.ts", content: "export const y = 2;", ext: ".ts" },
      { relPath: "src/api-client.ts", content: "export const z = 3;", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.naming.files, "kebab-case");
  });

  it("extracts function prefixes", () => {
    const files = [
      { relPath: "src/api.ts", content: "function getUser() {}\nfunction createUser() {}\nfunction deleteUser() {}\nfunction updateUser() {}", ext: ".ts" },
    ];
    const result = scan(files);
    assert.ok(result.naming.functionPrefixes.includes("get"));
    assert.ok(result.naming.functionPrefixes.includes("create"));
    assert.ok(result.naming.functionPrefixes.includes("delete"));
  });

  it("detects test file pattern *.test.{ext}", () => {
    const files = [
      { relPath: "src/user.test.ts", content: "test('x', () => {})", ext: ".ts" },
      { relPath: "src/auth.test.ts", content: "test('y', () => {})", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.naming.testFiles, ".test");
  });

  it("detects arrow function names", () => {
    const files = [
      { relPath: "src/utils.ts", content: "const fetchData = async () => {}\nconst processItem = () => {}", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.naming.functions, "camelCase");
    assert.ok(result.naming.functionPrefixes.includes("fetch"));
  });

  it("returns null styles for empty input", () => {
    const result = scan([]);
    assert.equal(result.naming.functions, null);
    assert.equal(result.naming.confidence, 0);
  });

  it("computes confidence based on match rate", () => {
    const files = [
      { relPath: "src/a.ts", content: "function getUser() {}\nfunction CreateUser() {}", ext: ".ts" },
    ];
    const result = scan(files);
    assert.ok(result.naming.confidence > 0);
    assert.ok(result.naming.confidence <= 100);
  });
});
