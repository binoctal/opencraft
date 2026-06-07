const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  measureFunctions,
  measureFiles,
  countTodos,
  calcTestRatio,
  findDuplicates,
  simpleHash,
  compareTrends,
  formatTrends,
  formatAntiPatterns,
  detectAntiPatterns,
  MAX_FILE_THRESHOLD,
} = require("../hooks/lib/quality-snapshot.cjs");

describe("quality-snapshot", () => {
  describe("measureFunctions", () => {
    it("measures function lengths", () => {
      const files = [{
        relPath: "test.js",
        content: `
function short() {
  return 1;
}

function long() {
  let a = 1;
  let b = 2;
  let c = 3;
  let d = 4;
  let e = 5;
  return a + b + c + d + e;
}
`,
      }];

      const result = measureFunctions(files);
      assert.ok(result.count >= 2);
      assert.ok(result.avg > 0);
      assert.ok(result.p75 > 0);
    });

    it("handles empty files", () => {
      const result = measureFunctions([]);
      assert.equal(result.count, 0);
      assert.equal(result.avg, 0);
    });

    it("detects arrow functions", () => {
      const files = [{
        relPath: "test.js",
        content: `
const add = (a, b) => {
  return a + b;
};
`,
      }];

      const result = measureFunctions(files);
      assert.ok(result.count >= 1);
    });
  });

  describe("measureFiles", () => {
    it("measures file lengths", () => {
      const files = [
        { relPath: "a.js", content: "line1\nline2\nline3" },
        { relPath: "b.js", content: "line1\nline2" },
      ];

      const result = measureFiles(files);
      assert.equal(result.count, 2);
      assert.equal(result.avg, 3); // (3+2)/2 rounded
      assert.equal(result.max, 3);
    });

    it("handles empty input", () => {
      const result = measureFiles([]);
      assert.equal(result.count, 0);
    });
  });

  describe("countTodos", () => {
    it("counts TODO/FIXME/HACK comments", () => {
      const files = [{
        relPath: "test.js",
        content: `
// TODO: fix this
// FIXME: broken
// HACK: workaround
// Normal comment
`,
      }];

      assert.equal(countTodos(files), 3);
    });

    it("handles no todos", () => {
      const files = [{ relPath: "test.js", content: "normal code" }];
      assert.equal(countTodos(files), 0);
    });
  });

  describe("calcTestRatio", () => {
    it("calculates test ratio", () => {
      const files = [
        { relPath: "src/app.ts", content: "" },
        { relPath: "src/utils.ts", content: "" },
        { relPath: "test/app.test.ts", content: "" },
        { relPath: "test/utils.spec.ts", content: "" },
      ];

      assert.equal(calcTestRatio(files), 0.5);
    });

    it("detects test directories", () => {
      const files = [
        { relPath: "src/app.ts", content: "" },
        { relPath: "__tests__/app.ts", content: "" },
      ];

      assert.equal(calcTestRatio(files), 0.5);
    });

    it("handles empty input", () => {
      assert.equal(calcTestRatio([]), 0);
    });
  });

  describe("findDuplicates", () => {
    it("finds duplicate code blocks", () => {
      const files = [
        {
          relPath: "a.js",
          content: `
const x = 1;
const y = 2;
const z = 3;
const w = 4;
const v = 5;
const u = 6;
`,
        },
        {
          relPath: "b.js",
          content: `
const x = 1;
const y = 2;
const z = 3;
const w = 4;
const v = 5;
const u = 6;
`,
        },
      ];

      const result = findDuplicates(files);
      assert.ok(result >= 1);
    });

    it("returns 0 for no duplicates", () => {
      const files = [
        { relPath: "a.js", content: "const a = 1;" },
        { relPath: "b.js", content: "const b = 2;" },
      ];

      assert.equal(findDuplicates(files), 0);
    });
  });

  describe("simpleHash", () => {
    it("produces consistent hashes", () => {
      assert.equal(simpleHash("hello"), simpleHash("hello"));
    });

    it("produces different hashes for different strings", () => {
      assert.notEqual(simpleHash("hello"), simpleHash("world"));
    });
  });

  describe("compareTrends", () => {
    it("detects function length increase", () => {
      const current = { metrics: { avgFnLength: 20 } };
      const previous = { metrics: { avgFnLength: 10 } };

      const trends = compareTrends(current, previous);
      assert.ok(trends.some(t => t.metric === "函数平均长度"));
      assert.ok(trends.some(t => t.direction === "worse"));
    });

    it("detects function length decrease as improvement", () => {
      const current = { metrics: { avgFnLength: 10 } };
      const previous = { metrics: { avgFnLength: 20 } };

      const trends = compareTrends(current, previous);
      assert.ok(trends.some(t => t.metric === "函数平均长度"));
      assert.ok(trends.some(t => t.direction === "better"));
    });

    it("filters insignificant changes (<5%)", () => {
      const current = { metrics: { avgFnLength: 101 } };
      const previous = { metrics: { avgFnLength: 100 } };

      const trends = compareTrends(current, previous);
      const fnTrend = trends.find(t => t.metric === "函数平均长度");
      assert.equal(fnTrend, undefined);
    });

    it("returns empty for no previous", () => {
      const current = { metrics: { avgFnLength: 20 } };
      assert.deepEqual(compareTrends(current, null), []);
    });
  });

  describe("formatTrends", () => {
    it("formats trends with arrows", () => {
      const trends = [
        { metric: "函数平均长度", from: 10, to: 20, change: "↑100%", direction: "worse" },
      ];

      const result = formatTrends(trends);
      assert.ok(result.includes("## Quality Trend"));
      assert.ok(result.includes("10 → 20"));
      assert.ok(result.includes("↑100%"));
    });

    it("returns null for empty trends", () => {
      assert.equal(formatTrends([]), null);
    });
  });

  describe("detectAntiPatterns", () => {
    it("detects large files", () => {
      const files = [{
        relPath: "large.js",
        content: "line\n".repeat(MAX_FILE_THRESHOLD + 100),
      }];

      const patterns = detectAntiPatterns(files);
      assert.ok(patterns.some(p => p.type === "large-file"));
    });

    it("returns empty for clean files", () => {
      const files = [{ relPath: "small.js", content: "const x = 1;" }];
      const patterns = detectAntiPatterns(files);
      assert.equal(patterns.length, 0);
    });
  });

  describe("formatAntiPatterns", () => {
    it("formats anti-patterns", () => {
      const patterns = [
        { file: "src/large.ts", detail: "500 lines — consider splitting", type: "large-file" },
      ];

      const result = formatAntiPatterns(patterns);
      assert.ok(result.includes("## Attention"));
      assert.ok(result.includes("src/large.ts"));
    });

    it("returns null for empty patterns", () => {
      assert.equal(formatAntiPatterns([]), null);
    });
  });
});
