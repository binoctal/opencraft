const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("session-start index line", () => {
  it("buildIndexLine includes tech stack", () => {
    const { buildIndexLine } = require("../hooks/session-start.cjs");
    const profile = { techStack: ["typescript", "docker"] };
    const line = buildIndexLine(profile, 5, 3, 2);
    assert.ok(line.includes("typescript"));
    assert.ok(line.includes("docker"));
  });

  it("buildIndexLine includes convention count", () => {
    const { buildIndexLine } = require("../hooks/session-start.cjs");
    const profile = { techStack: ["typescript"] };
    const line = buildIndexLine(profile, 12, 3, 0);
    assert.ok(line.includes("12 conventions"));
  });

  it("buildIndexLine includes decision count", () => {
    const { buildIndexLine } = require("../hooks/session-start.cjs");
    const profile = { techStack: ["typescript"] };
    const line = buildIndexLine(profile, 5, 8, 2);
    assert.ok(line.includes("8 decisions"));
  });

  it("buildIndexLine includes rule count", () => {
    const { buildIndexLine } = require("../hooks/session-start.cjs");
    const profile = { techStack: ["typescript"] };
    const line = buildIndexLine(profile, 5, 3, 7);
    assert.ok(line.includes("7 rules"));
  });

  it("buildIndexLine handles empty techStack", () => {
    const { buildIndexLine } = require("../hooks/session-start.cjs");
    const profile = { techStack: [] };
    const line = buildIndexLine(profile, 5, 3, 2);
    assert.ok(line.startsWith("[opencraft] 5 conventions"));
    assert.ok(!line.includes("/"));
  });

  it("buildIndexLine omits zero counts", () => {
    const { buildIndexLine } = require("../hooks/session-start.cjs");
    const profile = { techStack: ["typescript"] };
    const line = buildIndexLine(profile, 0, 0, 0);
    assert.ok(line.includes("typescript"));
    assert.ok(!line.includes("0 conventions"));
    assert.ok(!line.includes("0 decisions"));
    assert.ok(!line.includes("0 rules"));
  });

  it("buildIndexLine suggests opencraft:context", () => {
    const { buildIndexLine } = require("../hooks/session-start.cjs");
    const profile = { techStack: ["typescript"] };
    const line = buildIndexLine(profile, 5, 3, 0);
    assert.ok(line.includes("opencraft:context"));
  });
});
