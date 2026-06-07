const path = require("path");
const { run, fileExists } = require("../utils.cjs");

function isGitRepo(cwd) {
  return fileExists(path.join(cwd, ".git"));
}

function getActiveWork(cwd) {
  if (!isGitRepo(cwd)) return { activeWork: [], status: { summary: "no active work", details: [] } };

  const branch = run("git rev-parse --abbrev-ref HEAD", { cwd, timeout: 3000 });
  const branchName = branch.ok ? branch.stdout.trim() : "unknown";

  const statusResult = run("git status --porcelain", { cwd, timeout: 3000 });
  const dirty = statusResult.ok && statusResult.stdout.trim().length > 0;

  return {
    activeWork: [{ name: branchName, phase: "branch" }],
    status: {
      summary: dirty ? "dirty working tree" : "clean",
      details: dirty ? statusResult.stdout.trim().split("\n").slice(0, 5) : [],
    },
  };
}

module.exports = {
  name: "git",
  getActiveWork,
};
