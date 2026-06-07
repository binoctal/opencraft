const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { withMockedRun } = require("./helpers/mock-utils.cjs");

const ghIntelPath = require.resolve("../hooks/lib/github-intel.cjs");

describe("github-intel", () => {
  describe("gatherGitHubIntel", () => {
    it("returns available:false when gh CLI not found", () => {
      const mod = withMockedRun({}, ghIntelPath);
      const result = mod.gatherGitHubIntel("/fake");
      assert.equal(result.available, false);
    });

    it("returns available:false when gh repo view fails", () => {
      const mod = withMockedRun({
        "gh --version": { ok: true, stdout: "gh 2.40" },
      }, ghIntelPath);
      const result = mod.gatherGitHubIntel("/fake");
      assert.equal(result.available, false);
    });

    it("returns available:false when repo JSON parse fails", () => {
      const mod = withMockedRun({
        "gh --version": { ok: true, stdout: "gh 2.40" },
        "gh repo view": { ok: true, stdout: "not json" },
      }, ghIntelPath);
      const result = mod.gatherGitHubIntel("/fake");
      assert.equal(result.available, false);
    });

    it("returns repoName on success", () => {
      const mod = withMockedRun({
        "gh --version": { ok: true, stdout: "gh 2.40" },
        "gh repo view": { ok: true, stdout: '{"name": "my-repo"}' },
        "gh issue list": { ok: true, stdout: '{"totalCount": 5}' },
      }, ghIntelPath);
      const result = mod.gatherGitHubIntel("/fake");
      assert.equal(result.available, true);
      assert.equal(result.repoName, "my-repo");
      assert.equal(result.openIssues, 5);
    });

    it("returns openIssues:0 when issue list fails", () => {
      const mod = withMockedRun({
        "gh --version": { ok: true, stdout: "gh 2.40" },
        "gh repo view": { ok: true, stdout: '{"name": "my-repo"}' },
        "gh issue list": { ok: false, stdout: "" },
      }, ghIntelPath);
      const result = mod.gatherGitHubIntel("/fake");
      assert.equal(result.available, true);
      assert.equal(result.openIssues, 0);
    });

    it("returns openIssues:0 when issue JSON parse fails", () => {
      const mod = withMockedRun({
        "gh --version": { ok: true, stdout: "gh 2.40" },
        "gh repo view": { ok: true, stdout: '{"name": "my-repo"}' },
        "gh issue list": { ok: true, stdout: "bad json" },
      }, ghIntelPath);
      const result = mod.gatherGitHubIntel("/fake");
      assert.equal(result.openIssues, 0);
    });

    it("returns openIssues:0 when totalCount is missing", () => {
      const mod = withMockedRun({
        "gh --version": { ok: true, stdout: "gh 2.40" },
        "gh repo view": { ok: true, stdout: '{"name": "my-repo"}' },
        "gh issue list": { ok: true, stdout: '{"results": []}' },
      }, ghIntelPath);
      const result = mod.gatherGitHubIntel("/fake");
      assert.equal(result.openIssues, 0);
    });
  });
});
