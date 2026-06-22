const fs = require("fs");
const path = require("path");

const DEFAULT_TRIGGERS = {
  secret: "Write|Edit",
  branch: "Bash(git push*)",
  commit: "Bash(git commit*)",
  deps: "Write|Edit",
  quality: "Bash(git push*)",
};

const PATH_SKIP_RE = /\.(env|example|sample|template|fixture)(\.\w+)?$/;
const PATH_SKIP_DIR_RE = /(^|\/)(node_modules|vendor|\.cache|dist|build)\//;
const PATH_SKIP_DOTENV = /^\.env/;

const LINE_WHITELIST = /\b(test|example|your[-_]?|<YOUR_|REPLACE|placeholder|dummy|mock|sample|TODO|xxx|\*{3,})\b/i;

function shannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

const _cache = new Map();

function clearCache() {
  _cache.clear();
}

/**
 * Collect the set of rule ids that should NOT be loaded.
 * Two layers, unioned together:
 *   1. Global default: ~/.opencraft/disabled-rules.json  -> { "disabledRules": [...] }
 *   2. Per-project:    <cwd>/.opencraft/profile.json      -> { "disabledRules": [...] }
 * Rule files stay on disk; disabled ids are simply filtered out at load time.
 */
function _collectDisabledRuleIds(cwd) {
  const disabled = new Set();

  const readIds = (filePath) => {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(data?.disabledRules)) {
        for (const id of data.disabledRules) {
          if (typeof id === "string") disabled.add(id);
        }
      }
    } catch {}
  };

  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) readIds(path.join(home, ".opencraft", "disabled-rules.json"));
  readIds(path.join(cwd, ".opencraft", "profile.json"));

  return disabled;
}

function loadRules(cwd) {
  if (_cache.has(cwd)) return _cache.get(cwd);

  const rules = [];

  const builtInDir = path.join(__dirname, "rules");
  if (fs.existsSync(builtInDir)) {
    _loadRulesFromDir(builtInDir, rules);
  }

  const userDir = path.join(cwd, ".opencraft", "rules");
  if (fs.existsSync(userDir)) {
    const userRules = [];
    _loadRulesFromDir(userDir, userRules);
    for (const ur of userRules) {
      const idx = rules.findIndex(r => r.id === ur.id);
      if (idx >= 0) {
        rules[idx] = ur;
      } else {
        rules.push(ur);
      }
    }
  }

  // Filter out disabled rules (files remain on disk for easy re-enabling).
  const disabledIds = _collectDisabledRuleIds(cwd);
  const enabled = disabledIds.size > 0
    ? rules.filter(r => !disabledIds.has(r.id))
    : rules;

  _cache.set(cwd, enabled);
  return enabled;
}

function _loadRulesFromDir(dir, rules) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      _loadRulesFromDir(fullPath, rules);
    } else if (entry.isFile() && entry.name.endsWith(".cjs")) {
      try {
        const loaded = require(fullPath);
        if (Array.isArray(loaded)) {
          rules.push(...loaded);
        }
      } catch (e) {
        console.error(`[opencraft] warning: failed to load rule ${fullPath}: ${e.message}`);
      }
    }
  }
}

function matchRules(triggerEvent, rules) {
  const events = triggerEvent.split("|").map(p => p.trim()).filter(Boolean);
  return rules.filter(rule => {
    const trigger = rule.trigger || DEFAULT_TRIGGERS[rule.type] || "";
    const patterns = trigger.split("|").map(p => p.trim()).filter(Boolean);
    return events.some(ev => patterns.some(pattern => _matchesTrigger(ev, pattern)));
  });
}

function _matchesTrigger(event, pattern) {
  const globMatch = pattern.match(/^(\w+)\((.+)\)$/);
  if (globMatch) {
    const tool = globMatch[1];
    const glob = globMatch[2].replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const eventToolMatch = event.match(/^(\w+)(?:\((.+)\))?$/);
    if (!eventToolMatch || eventToolMatch[1] !== tool) return false;
    const eventCmd = eventToolMatch[2] || "";
    return new RegExp("^" + glob + "$").test(eventCmd);
  }
  const eventTool = event.replace(/\(.*\)$/, "").trim();
  return eventTool === pattern;
}

function executeRules(rules, context) {
  const { content, filePath } = context;
  const findings = [];
  const messages = [];
  let blocked = false;

  for (const rule of rules) {
    if (rule.type === "secret" && content) {
      if (_isPathSkipped(filePath)) continue;

      if (rule.multiline) {
        const finding = _checkMultilineRule(rule, content, filePath);
        if (finding) findings.push(finding);
      } else {
        const found = _checkLineRule(rule, content, filePath);
        findings.push(...found);
      }
    } else if (rule.check) {
      try {
        const result = rule.check(context);
        if (result) {
          if (result.blocked) blocked = true;
          if (result.message) messages.push(result.message);
        }
      } catch (e) {
        console.error(`[opencraft] warning: rule ${rule.id} threw: ${e.message}`);
      }
    }
  }

  if (findings.length > 0) {
    const hasBlockable = findings.some(f => {
      const severity = f.severity || "medium";
      return severity === "critical" || severity === "high";
    });
    if (hasBlockable) blocked = true;
  }

  return { blocked, messages, findings };
}

function _isPathSkipped(filePath) {
  if (!filePath) return false;
  const base = path.basename(filePath);
  if (PATH_SKIP_RE.test(base)) return true;
  if (PATH_SKIP_DOTENV.test(base)) return true;
  if (PATH_SKIP_DIR_RE.test(filePath)) return true;
  return false;
}

function _checkLineRule(rule, content, filePath) {
  const lines = content.split("\n");
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (rule.keywords && rule.keywords.length > 0) {
      if (!rule.keywords.some(kw => line.includes(kw))) continue;
    }

    const match = line.match(rule.regex);
    if (!match) continue;

    if (rule.entropy && rule.entropy > 0) {
      const ent = shannonEntropy(match[0]);
      if (ent < rule.entropy) continue;
    }

    if (rule.allowlist && rule.allowlist.length > 0) {
      if (rule.allowlist.some(pat => pat.test(match[0]) || pat.test(line))) continue;
    }

    if (LINE_WHITELIST.test(line)) continue;

    results.push({
      ruleId: rule.id,
      name: rule.name,
      severity: rule.severity || "medium",
      line: i + 1,
      preview: match[0].slice(0, 12) + "...",
    });
  }

  return results;
}

function _checkMultilineRule(rule, content, filePath) {
  if (rule.keywords && rule.keywords.length > 0) {
    if (!rule.keywords.some(kw => content.includes(kw))) return null;
  }

  const match = content.match(rule.regex);
  if (!match) return null;

  if (rule.allowlist && rule.allowlist.length > 0) {
    if (rule.allowlist.some(pat => pat.test(match[0]))) return null;
  }

  const beforeMatch = content.slice(0, match.index);
  const line = (beforeMatch.match(/\n/g) || []).length + 1;

  return {
    ruleId: rule.id,
    name: rule.name,
    severity: rule.severity || "medium",
    line,
    preview: match[0].slice(0, 30) + "...",
  };
}

module.exports = {
  shannonEntropy,
  DEFAULT_TRIGGERS,
  loadRules,
  matchRules,
  executeRules,
  clearCache,
};
