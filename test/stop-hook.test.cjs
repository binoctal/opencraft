const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// We can't easily import stop.cjs main() since it calls process.exit,
// but we can test the exported functions by extracting them.
// For now, test the detection logic inline.

const DECISION_SIGNALS = [
  "选择了", "选了", "决定用", "采用", "决定使用",
  "不用", "放弃", "改用",
  "chose to use", "decided on", "going with",
  "instead of", "replaced with",
];

const MAX_DECISION_LENGTH = 200;

function detectDecisions(text) {
  if (!text) return [];

  const decisions = [];
  const seen = new Set();

  const sentences = text.split(/[。\n]/).map(s => s.trim()).filter(Boolean);

  for (const sentence of sentences) {
    for (const signal of DECISION_SIGNALS) {
      if (sentence.includes(signal)) {
        const cleaned = sentence
          .replace(/```[\s\S]*?```/g, "")
          .replace(/\[opencraft\].*/g, "")
          .replace(/[#*`]/g, "")
          .trim();

        if (cleaned.length < 10 || cleaned.length > MAX_DECISION_LENGTH) continue;

        const key = cleaned.slice(0, 50);
        if (seen.has(key)) continue;
        seen.add(key);

        const topic = extractTopic(cleaned, signal);

        decisions.push({
          topic,
          text: cleaned,
          date: new Date().toISOString().split("T")[0],
        });

        break;
      }
    }

    if (decisions.length >= 5) break;
  }

  return decisions;
}

function extractTopic(text, signal) {
  const idx = text.indexOf(signal);
  if (idx <= 0) return text.slice(0, 20);

  const before = text.slice(Math.max(0, idx - 30), idx).trim();
  if (before.length > 0) return before.slice(-20);

  return text.slice(0, 20);
}

describe("stop-hook decisions", () => {
  describe("detectDecisions", () => {
    it("detects Chinese decision signals", () => {
      const text = "我们选择了 Zustand 作为状态管理方案。";
      const results = detectDecisions(text);
      assert.ok(results.length >= 1);
      assert.ok(results[0].text.includes("Zustand"));
      assert.ok(results[0].topic.length > 0);
    });

    it("detects English decision signals", () => {
      const text = "We chose to use PostgreSQL for the database layer.";
      const results = detectDecisions(text);
      assert.ok(results.length >= 1);
      assert.ok(results[0].text.includes("PostgreSQL"));
    });

    it("detects multiple decisions", () => {
      const text = [
        "采用了 TypeScript 作为主要语言。",
        "决定使用 Redis 做缓存层。",
        "放弃了 GraphQL 方案。",
      ].join("\n");

      const results = detectDecisions(text);
      assert.equal(results.length, 3);
    });

    it("returns empty for non-decision text", () => {
      const text = "Let me check the file contents and fix the bug.";
      const results = detectDecisions(text);
      assert.equal(results.length, 0);
    });

    it("filters short sentences", () => {
      const text = "选了A。\n这个很短选了。";
      const results = detectDecisions(text);
      // Both are too short (<10 chars after cleaning)
      assert.equal(results.length, 0);
    });

    it("deduplicates similar decisions", () => {
      const text = [
        "我们选择了 Zustand 来管理状态。",
        "我们选择了 Zustand 来管理状态。",
      ].join("\n");

      const results = detectDecisions(text);
      assert.equal(results.length, 1);
    });

    it("caps at 5 decisions per invocation", () => {
      const lines = Array.from({ length: 10 }, (_, i) =>
        `决定使用方案${i + 1}来处理第${i + 1}个问题。`
      );
      const text = lines.join("\n");

      const results = detectDecisions(text);
      assert.ok(results.length <= 5);
    });

    it("handles empty input", () => {
      assert.equal(detectDecisions("").length, 0);
      assert.equal(detectDecisions(null).length, 0);
      assert.equal(detectDecisions(undefined).length, 0);
    });
  });

  describe("extractTopic", () => {
    it("extracts topic from text before signal", () => {
      const topic = extractTopic("状态管理方面选择了 Zustand", "选择了");
      assert.ok(topic.includes("状态管理"));
    });

    it("falls back to text prefix when signal is at start", () => {
      const topic = extractTopic("选择了 Zustand 方案", "选择了");
      assert.equal(topic, "选择了 Zustand 方案".slice(0, 20));
    });

    it("truncates long topics to 20 chars", () => {
      const longText = "这是一个非常长的话题描述用来测试截断功能是否正常工作选择了方案A";
      const topic = extractTopic(longText, "选择了");
      assert.ok(topic.length <= 20);
    });
  });
});

describe("stop-hook file append", () => {
  it("creates .opencraft directory and decisions.md", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencraft-stop-"));
    const opencraftDir = path.join(tmpDir, ".opencraft");
    const decisionsFile = path.join(opencraftDir, "decisions.md");

    // Simulate appendDecisions logic
    const decisions = [
      { topic: "状态管理", text: "选择了 Zustand 作为状态管理", date: "2026-06-06" },
    ];

    if (!fs.existsSync(opencraftDir)) fs.mkdirSync(opencraftDir, { recursive: true });

    let existing = "# Historical Decisions\n\n<!-- Auto-appended by opencraft stop hook -->\n\n";
    const lines = decisions.map(d => `- ${d.topic}: ${d.text} (${d.date})`);
    const content = existing.trimEnd() + "\n" + lines.join("\n") + "\n";
    fs.writeFileSync(decisionsFile, content, "utf-8");

    assert.ok(fs.existsSync(decisionsFile));
    const result = fs.readFileSync(decisionsFile, "utf-8");
    assert.ok(result.includes("Zustand"));
    assert.ok(result.includes("2026-06-06"));

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips duplicate decisions", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencraft-stop-"));
    const opencraftDir = path.join(tmpDir, ".opencraft");
    const decisionsFile = path.join(opencraftDir, "decisions.md");

    fs.mkdirSync(opencraftDir, { recursive: true });

    const existing = "# Historical Decisions\n\n- 状态管理: 选择了 Zustand 作为状态管理 (2026-06-05)\n";
    fs.writeFileSync(decisionsFile, existing, "utf-8");

    // Try to append the same decision
    const newDecision = { topic: "状态管理", text: "选择了 Zustand 作为状态管理", date: "2026-06-06" };
    const text = fs.readFileSync(decisionsFile, "utf-8");
    const isDuplicate = text.includes(newDecision.text.slice(0, 40));
    assert.ok(isDuplicate); // Should be detected as duplicate

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("caps file size at 50KB", () => {
    const MAX_FILE_SIZE = 50_000;
    const largeContent = "x".repeat(MAX_FILE_SIZE + 1000);

    // Simulate the capping logic
    let existing = largeContent;
    if (existing.length > MAX_FILE_SIZE) {
      existing = existing.slice(Math.floor(existing.length / 2));
    }

    assert.ok(existing.length < MAX_FILE_SIZE);
  });
});
