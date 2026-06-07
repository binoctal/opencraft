const { run } = require("../utils.cjs");

const MAX_FILES = 10;
const MAX_COMMITS = 5;
const MAX_BRANCHES = 5;

function gatherGitIntel(cwd) {
  const branch = _getBranch(cwd);
  if (!branch) return null; // not a git repo

  const status = _getStatus(cwd);
  const commits = _getRecentCommits(cwd);
  const unmerged = _getUnmergedBranches(cwd);
  const stashCount = _getStashCount(cwd);

  return {
    branch,
    isClean: status.totalChanges === 0,
    workingTree: status,
    recentCommits: commits,
    unmergedBranches: unmerged,
    stashCount,
  };
}

function _getBranch(cwd) {
  const r = run("git rev-parse --abbrev-ref HEAD", { cwd, timeout: 2000 });
  if (!r.ok) return null;
  const name = r.stdout;
  return name === "HEAD" ? "HEAD (detached)" : name;
}

function _getStatus(cwd) {
  const r = run("git status --porcelain", { cwd, timeout: 3000 });
  if (!r.ok) return { modified: 0, added: 0, deleted: 0, untracked: 0, totalChanges: 0, files: [] };

  let modified = 0, added = 0, deleted = 0, untracked = 0;
  const files = [];

  for (const line of r.stdout.split("\n").filter(Boolean)) {
    const code = line.slice(0, 2);
    const filePath = line.slice(3);
    if (code.includes("?")) { untracked++; }
    else if (code.includes("D")) { deleted++; }
    else if (code.includes("A") || code.includes("R")) { added++; }
    else { modified++; }
    if (files.length < MAX_FILES) files.push(line);
  }

  return {
    modified, added, deleted, untracked,
    totalChanges: modified + added + deleted + untracked,
    files,
  };
}

function _getRecentCommits(cwd) {
  const fmt = "--pretty=format:%h %s";
  const r = run(`git log --oneline -${MAX_COMMITS} ${fmt}`, { cwd, timeout: 2000 });
  if (!r.ok) return [];
  return r.stdout.split("\n").filter(Boolean).map(line => {
    const space = line.indexOf(" ");
    return { hash: line.slice(0, space), subject: line.slice(space + 1).slice(0, 60) };
  });
}

function _getUnmergedBranches(cwd) {
  for (const base of ["main", "master"]) {
    const r = run(`git branch --no-merged ${base} --sort=-committerdate --format="%(refname:short) %(committerdate:relative)"`, { cwd, timeout: 3000 });
    if (!r.ok) continue;

    const all = r.stdout.split("\n").filter(Boolean).map(line => {
      const space = line.indexOf(" ");
      return { name: line.slice(0, space), lastCommit: line.slice(space + 1) };
    });
    return { total: all.length, shown: all.slice(0, MAX_BRANCHES) };
  }
  return { total: 0, shown: [] };
}

function _getStashCount(cwd) {
  const r = run("git stash list", { cwd, timeout: 2000 });
  if (!r.ok) return 0;
  return r.stdout.split("\n").filter(Boolean).length;
}

module.exports = { gatherGitIntel };
