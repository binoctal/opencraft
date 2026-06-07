const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  estimateTokens,
  sortSignals,
  selectSignals,
  formatContext,
  groupBySection,
} = require("../hooks/lib/smart-context.cjs");

describe("smart-context", () => {
  describe("estimateTokens", () => {
    it("estimates tokens from string length", () => {
      // ~4 chars per token
      assert.equal(estimateTokens("hello"), 2); // 5 chars = 2 tokens
      assert.equal(estimateTokens(""), 0);
    });

    it("returns 0 for null", () => {
      assert.equal(estimateTokens(null), 0);
    });

    it("handles longer strings", () => {
      const text = "a".repeat(100);
      assert.equal(estimateTokens(text), 25);
    });
  });

  describe("sortSignals", () => {
    it("sorts by priority descending", () => {
      const signals = [
        { priority: 50, section: "A" },
        { priority: 90, section: "B" },
        { priority: 70, section: "C" },
      ];
      const sorted = sortSignals(signals);
      assert.equal(sorted[0].priority, 90);
      assert.equal(sorted[1].priority, 70);
      assert.equal(sorted[2].priority, 50);
    });

    it("sorts by section name for equal priority", () => {
      const signals = [
        { priority: 70, section: "Zebra" },
        { priority: 70, section: "Alpha" },
      ];
      const sorted = sortSignals(signals);
      assert.equal(sorted[0].section, "Alpha");
      assert.equal(sorted[1].section, "Zebra");
    });

    it("does not mutate original array", () => {
      const signals = [{ priority: 50 }, { priority: 90 }];
      sortSignals(signals);
      assert.equal(signals[0].priority, 50);
    });
  });

  describe("selectSignals", () => {
    it("selects signals within budget", () => {
      const signals = [
        { priority: 90, tokens: 30 },
        { priority: 70, tokens: 40 },
        { priority: 50, tokens: 50 },
      ];
      const selected = selectSignals(signals, 100);
      assert.equal(selected.length, 2);
      assert.equal(selected[0].priority, 90);
      assert.equal(selected[1].priority, 70);
    });

    it("skips signals that exceed remaining budget", () => {
      const signals = [
        { priority: 90, tokens: 80 },
        { priority: 70, tokens: 30 }, // 80+30=110 > 100, skipped
        { priority: 50, tokens: 15 }, // 80+15=95 < 100, included
      ];
      const selected = selectSignals(signals, 100);
      assert.equal(selected.length, 2); // 90 and 50
      assert.equal(selected[0].priority, 90);
      assert.equal(selected[1].priority, 50);
    });

    it("handles empty budget", () => {
      const signals = [{ priority: 90, tokens: 10 }];
      const selected = selectSignals(signals, 0);
      assert.equal(selected.length, 0);
    });

    it("handles no signals", () => {
      const selected = selectSignals([], 100);
      assert.equal(selected.length, 0);
    });
  });

  describe("groupBySection", () => {
    it("groups signals by section", () => {
      const signals = [
        { section: "A", content: "1" },
        { section: "B", content: "2" },
        { section: "A", content: "3" },
      ];
      const groups = groupBySection(signals);
      assert.equal(Object.keys(groups).length, 2);
      assert.equal(groups["A"].length, 2);
      assert.equal(groups["B"].length, 1);
    });

    it("handles empty signals", () => {
      const groups = groupBySection([]);
      assert.deepEqual(groups, {});
    });
  });

  describe("formatContext", () => {
    it("formats signals into sections", () => {
      const signals = [
        { section: "Project", content: "Tech: javascript", priority: 50 },
        { section: "Working Tree", content: "Clean", priority: 30 },
      ];
      const context = formatContext(signals);
      assert.ok(context.includes("## Project"));
      assert.ok(context.includes("## Working Tree"));
      assert.ok(context.includes("Tech: javascript"));
    });

    it("orders sections by highest priority signal", () => {
      const signals = [
        { section: "Low", content: "low priority", priority: 20 },
        { section: "High", content: "high priority", priority: 90 },
      ];
      const context = formatContext(signals);
      const highIdx = context.indexOf("## High");
      const lowIdx = context.indexOf("## Low");
      assert.ok(highIdx < lowIdx);
    });

    it("handles empty signals", () => {
      const context = formatContext([]);
      assert.equal(context, "");
    });
  });
});
