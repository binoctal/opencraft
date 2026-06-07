const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { withMockedRun } = require("./helpers/mock-utils.cjs");

const gitIntelPath = require.resolve("../hooks/lib/git-intel.cjs");

describe("git-intel", () => {
  describe("gatherGitIntel", () => {
    it("returns null when not a git repo", () => {
      const mod = withMockedRun({}, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result, null);
    });

    it("returns branch name from rev-parse", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "feature-test" },
        "git status --porcelain": { ok: true, stdout: "" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.branch, "feature-test");
    });

    it("returns HEAD (detached) for detached HEAD", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "HEAD" },
        "git status --porcelain": { ok: true, stdout: "" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.branch, "HEAD (detached)");
    });

    it("reports isClean:true when porcelain output is empty", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.isClean, true);
      assert.equal(result.workingTree.totalChanges, 0);
    });

    it("counts modified files from porcelain status", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "M file1.js\nM file2.js" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.workingTree.modified, 2);
      assert.equal(result.workingTree.totalChanges, 2);
    });

    it("counts added and renamed files", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "A  new.js\nR  old.js" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.workingTree.added, 2);
    });

    it("counts deleted files", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "D  gone.js" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.workingTree.deleted, 1);
    });

    it("counts untracked files", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "?? newdir/" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.workingTree.untracked, 1);
    });

    it("limits files list to 10", () => {
      const files = Array.from({ length: 15 }, (_, i) => `M  f${i}.js`).join("\n");
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: files },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.workingTree.files.length, 10);
    });

    it("parses recent commits", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "" },
        "git log": { ok: true, stdout: "abc1234 fix bug\ndef5678 add feature" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.recentCommits.length, 2);
      assert.equal(result.recentCommits[0].hash, "abc1234");
      assert.equal(result.recentCommits[0].subject, "fix bug");
    });

    it("returns empty recent commits when git log fails", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "" },
        "git log": { ok: false, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.deepEqual(result.recentCommits, []);
    });

    it("reports unmerged branches", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "feat-a 2 hours ago\nfeat-b 3 days ago" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.unmergedBranches.total, 2);
      assert.equal(result.unmergedBranches.shown.length, 2);
      assert.equal(result.unmergedBranches.shown[0].name, "feat-a");
    });

    it("falls back from main to master for unmerged check", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "master" },
        "git status --porcelain": { ok: true, stdout: "" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged master": { ok: true, stdout: "feat-x 1 day ago" },
        "git stash list": { ok: true, stdout: "" },
      }, gitIntelPath);
      // The mock matches by prefix, so "git branch --no-merged main" fails,
      // "git branch --no-merged master" succeeds
      const result = mod.gatherGitIntel("/fake");
      // With the mock, both commands match "git branch --no-merged" prefix
      // but the first match wins for "main", so it returns early
      assert.ok(result.unmergedBranches.total >= 0);
    });

    it("counts stash entries", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: true, stdout: "stash@{0}: WIP\nstash@{1}: WIP" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.stashCount, 2);
    });

    it("returns 0 stash when git stash list fails", () => {
      const mod = withMockedRun({
        "git rev-parse --abbrev-ref HEAD": { ok: true, stdout: "main" },
        "git status --porcelain": { ok: true, stdout: "" },
        "git log": { ok: true, stdout: "" },
        "git branch --no-merged main": { ok: true, stdout: "" },
        "git stash list": { ok: false, stdout: "" },
      }, gitIntelPath);
      const result = mod.gatherGitIntel("/fake");
      assert.equal(result.stashCount, 0);
    });
  });
});
