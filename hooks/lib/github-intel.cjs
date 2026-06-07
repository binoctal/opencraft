const { run } = require("../utils.cjs");

function gatherGitHubIntel(cwd) {
  // Check gh CLI
  const ver = run("gh --version", { timeout: 2000 });
  if (!ver.ok) return { available: false };

  // Check if this is a GitHub repo
  const repo = run("gh repo view --json name", { cwd, timeout: 3000 });
  if (!repo.ok) return { available: false };

  let repoName = "";
  try {
    repoName = JSON.parse(repo.stdout).name;
  } catch {
    return { available: false };
  }

  // Get open issues count
  const issues = run("gh issue list --limit 1 --json totalCount", { cwd, timeout: 3000 });
  let openIssues = 0;
  if (issues.ok) {
    try {
      openIssues = JSON.parse(issues.stdout).totalCount || 0;
    } catch {}
  }

  return { available: true, repoName, openIssues };
}

module.exports = { gatherGitHubIntel };
