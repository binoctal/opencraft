const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  extractTopic,
  formatDate,
  readFallback,
  isQualityDecision,
} = require("../hooks/lib/collectors/decisions.cjs");

describe("decisions collector", () => {
  describe("extractTopic", () => {
    it("extracts topic from '选择 X' pattern", () => {
      assert.equal(extractTopic("选择 Zustand 作为状态管理"), "Zustand 作为状态管理");
    });

    it("extracts topic from '使用 X' pattern", () => {
      assert.equal(extractTopic("使用 react-query 处理 API"), "react-query 处理 API");
    });

    it("extracts topic from colon pattern", () => {
      // "选择 X" pattern takes priority
      assert.equal(extractTopic("状态管理：选择 Zustand"), "Zustand");
      // Colon pattern works when no verb pattern present
      assert.equal(extractTopic("架构：微服务设计"), "架构");
    });

    it("truncates long topics", () => {
      const result = extractTopic("选择 " + "a".repeat(50));
      assert.ok(result.length <= 23); // 20 chars + "..."
    });

    it("handles null input", () => {
      assert.equal(extractTopic(null), "其他");
    });

    it("handles empty string", () => {
      assert.equal(extractTopic(""), "其他");
    });
  });

  describe("formatDate", () => {
    it("formats timestamp to YYYY-MM-DD", () => {
      assert.equal(formatDate(1780328521851), "2026-06-01");
    });

    it("returns null for null input", () => {
      assert.equal(formatDate(null), null);
    });

    it("returns null for undefined", () => {
      assert.equal(formatDate(undefined), null);
    });
  });

  describe("readFallback", () => {
    it("returns empty array for missing file", () => {
      const result = readFallback("/nonexistent/path");
      assert.deepEqual(result, []);
    });
  });

  describe("isQualityDecision", () => {
    it("rejects old handoff config fragments", () => {
      assert.equal(isQualityDecision('"approve"`）'), false);
      assert.equal(isQualityDecision('"approve"`，允许退出'), false);
      assert.equal(isQualityDecision('"block"`，阻止退出，并要求 Claude 先写一份 handoff'), false);
      assert.equal(isQualityDecision('"block"` + 提示 Claude 写 handoff'), false);
    });

    it("rejects backtick-prefixed fragments", () => {
      assert.equal(isQualityDecision("`approve` → allow exit"), false);
    });

    it("rejects very short decisions", () => {
      assert.equal(isQualityDecision(""), false);
      assert.equal(isQualityDecision(null), false);
      assert.equal(isQualityDecision("short"), false);
    });

    it("accepts meaningful decisions", () => {
      assert.equal(isQualityDecision("选择 Zustand 作为状态管理方案，替代 Redux"), true);
      assert.equal(isQualityDecision("采用 TypeScript 严格模式，所有 API 响应必须定义类型"), true);
      assert.equal(isQualityDecision("We chose PostgreSQL over MongoDB for relational data integrity"), true);
    });
  });
});
