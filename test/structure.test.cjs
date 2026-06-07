const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { scan } = require("../hooks/lib/scanners/structure.cjs");

describe("structure scanner", () => {
  it("computes average function length", () => {
    const files = [
      {
        relPath: "src/utils.ts",
        content: "function a() {\n  return 1;\n}\n\nfunction b() {\n  const x = 2;\n  const y = 3;\n  return x + y;\n}",
        ext: ".ts",
      },
    ];
    const result = scan(files);
    assert.ok(result.structure.avgFnLength > 0);
    assert.ok(result.structure.avgFileLength > 0);
  });

  it("computes percentiles", () => {
    const files = [
      {
        relPath: "src/big.ts",
        content: Array.from({ length: 10 }, (_, i) =>
          `function fn${i}() {\n${"  line;\n".repeat(i + 2)}}`
        ).join("\n\n"),
        ext: ".ts",
      },
    ];
    const result = scan(files);
    assert.ok(result.structure.p75 >= result.structure.avgFnLength);
    assert.ok(result.structure.p90 >= result.structure.p75);
  });

  it("detects source directory", () => {
    const files = [
      { relPath: "src/a.ts", content: "export const x = 1;", ext: ".ts" },
      { relPath: "src/b.ts", content: "export const y = 2;", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.structure.srcDir, "src");
  });

  it("detects test directory", () => {
    const files = [
      { relPath: "test/a.test.ts", content: "test('x', () => {});", ext: ".ts" },
      { relPath: "test/b.test.ts", content: "test('y', () => {});", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.structure.testDir, "test");
  });

  it("detects named export style", () => {
    const files = [
      { relPath: "src/a.ts", content: "export const x = 1;\nexport function y() {}", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.structure.exportStyle, "named");
  });

  it("detects default export style", () => {
    const files = [
      { relPath: "src/a.ts", content: "export default class App {}", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.structure.exportStyle, "default");
  });

  it("computes max file length", () => {
    const files = [
      { relPath: "src/short.ts", content: "x\ny\nz", ext: ".ts" },
      { relPath: "src/long.ts", content: Array.from({ length: 100 }, () => "line").join("\n"), ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.structure.maxFileLength, 100);
    assert.ok(result.structure.avgFileLength > 0);
  });

  it("handles empty file list", () => {
    const result = scan([]);
    assert.equal(result.structure.avgFnLength, 0);
    assert.equal(result.structure.avgFileLength, 0);
    assert.equal(result.structure.testDir, null);
    assert.equal(result.structure.srcDir, null);
    assert.equal(result.structure.exportStyle, null);
  });
});
