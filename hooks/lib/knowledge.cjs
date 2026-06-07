const fs = require("fs");
const path = require("path");
const os = require("os");

const SECTION_MAP = {
  preferences: "Preferences",
  patterns: "Patterns",
  decisions: "Decisions",
  gotchas: "Gotchas",
};

const CCCMEMORY_PATHS = [
  path.join(process.env.HOME || "", ".cccmemory.db"),
  path.join(process.env.HOME || "", ".config", "cccmemory", "memory.db"),
];

function hasCccmemory(customPaths) {
  const paths = customPaths || CCCMEMORY_PATHS;
  for (const dbPath of paths) {
    if (fs.existsSync(dbPath)) return true;
  }
  return false;
}

function _knowledgePath(cwd) {
  return path.join(cwd, ".opencraft", "knowledge.md");
}

function _ensureHeader(content) {
  if (!content || !content.startsWith("# Project Knowledge")) {
    return "# Project Knowledge\n\n";
  }
  return content;
}

function _ensureSection(content, sectionTitle) {
  const header = `## ${sectionTitle}`;
  if (content.includes(header)) return content;
  return content.trimEnd() + "\n\n" + header + "\n";
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function writeKnowledgeFile(cwd, entry) {
  const filePath = _knowledgePath(cwd);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let content = "";
  try { content = fs.readFileSync(filePath, "utf-8"); } catch {}
  content = _ensureHeader(content);

  const sectionTitle = SECTION_MAP[entry.type];
  if (!sectionTitle) return;

  content = _ensureSection(content, sectionTitle);

  const today = new Date().toISOString().split("T")[0];
  const lineRegex = new RegExp(`^- ${escapeRegex(entry.key)} \\(\\d{4}-\\d{2}-\\d{2}\\): .+$`, "m");

  const newLine = `- ${entry.key} (${today}): ${entry.value}`;

  if (lineRegex.test(content)) {
    content = content.replace(lineRegex, newLine);
  } else {
    const sectionHeader = `## ${sectionTitle}`;
    const idx = content.indexOf(sectionHeader) + sectionHeader.length;
    content = content.slice(0, idx) + "\n" + newLine + content.slice(idx);
  }

  fs.writeFileSync(filePath, content.trimEnd() + "\n", "utf-8");
}

function readKnowledgeFile(cwd, type) {
  const filePath = _knowledgePath(cwd);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf-8");
  const sectionTitle = SECTION_MAP[type];
  if (!sectionTitle) return [];

  const sectionRegex = new RegExp(`^## ${sectionTitle}$`, "m");
  const match = sectionRegex.exec(content);
  if (!match) return [];

  const sectionStart = match.index + match[0].length;
  const nextSection = content.indexOf("\n## ", sectionStart);
  const sectionContent = nextSection === -1
    ? content.slice(sectionStart)
    : content.slice(sectionStart, nextSection);

  const lines = sectionContent.split("\n").filter(l => l.startsWith("- "));
  return lines.map(line => {
    const m = line.match(/^- (.+?) \((\d{4}-\d{2}-\d{2})\): ?(.*)$/);
    if (!m) return null;
    return { key: m[1], date: m[2], value: m[3] };
  }).filter(Boolean);
}

function _globalKnowledgePath(globalDir) {
  return path.join(globalDir, ".opencraft", "knowledge.md");
}

function _readAllFromFile(filePath, scope) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const entries = [];
  for (const [type, sectionTitle] of Object.entries(SECTION_MAP)) {
    const sectionRegex = new RegExp(`^## ${sectionTitle}$`, "m");
    const match = sectionRegex.exec(content);
    if (!match) continue;
    const sectionStart = match.index + match[0].length;
    const nextSection = content.indexOf("\n## ", sectionStart);
    const sectionContent = nextSection === -1
      ? content.slice(sectionStart)
      : content.slice(sectionStart, nextSection);
    const lines = sectionContent.split("\n").filter(l => l.startsWith("- "));
    for (const line of lines) {
      const m = line.match(/^- (.+?) \((\d{4}-\d{2}-\d{2})\): ?(.*)$/);
      if (m) entries.push({ key: m[1], date: m[2], value: m[3], type, scope });
    }
  }
  return entries;
}

function readAll(cwd, globalDir) {
  const projectEntries = _readAllFromFile(_knowledgePath(cwd), "project");
  const globalEntries = _readAllFromFile(_globalKnowledgePath(globalDir || os.homedir()), "global");
  return [...projectEntries, ...globalEntries];
}

function _removeLineFromFile(filePath, key) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const lineRegex = new RegExp(`^- ${escapeRegex(key)} \\(\\d{4}-\\d{2}-\\d{2}\\):.*\\n?`, "m");
  content = content.replace(lineRegex, "");
  fs.writeFileSync(filePath, content, "utf-8");
}

function promote(cwd, globalDir, key) {
  const projPath = _knowledgePath(cwd);
  const entries = _readAllFromFile(projPath, "project");
  const entry = entries.find(e => e.key === key);
  if (!entry) return;
  writeKnowledgeFile(globalDir || os.homedir(), { type: entry.type, key: entry.key, value: entry.value });
  _removeLineFromFile(projPath, key);
}

function demote(cwd, globalDir, key) {
  const globPath = _globalKnowledgePath(globalDir || os.homedir());
  const entries = _readAllFromFile(globPath, "global");
  const entry = entries.find(e => e.key === key);
  if (!entry) return;
  writeKnowledgeFile(cwd, { type: entry.type, key: entry.key, value: entry.value });
  _removeLineFromFile(globPath, key);
}

function deleteEntry(cwd, globalDir, key, scope) {
  if (scope === "global") {
    _removeLineFromFile(_globalKnowledgePath(globalDir || os.homedir()), key);
  } else {
    _removeLineFromFile(_knowledgePath(cwd), key);
  }
}

function editEntry(cwd, globalDir, key, scope, newValue) {
  const targetDir = scope === "global" ? (globalDir || os.homedir()) : cwd;
  const filePath = scope === "global"
    ? _globalKnowledgePath(globalDir || os.homedir())
    : _knowledgePath(cwd);
  const entries = _readAllFromFile(filePath, scope);
  const entry = entries.find(e => e.key === key);
  if (!entry) return;
  writeKnowledgeFile(targetDir, { type: entry.type, key: entry.key, value: newValue });
}

module.exports = {
  hasCccmemory,
  writeKnowledgeFile,
  readKnowledgeFile,
  readAll,
  promote,
  demote,
  deleteEntry,
  editEntry,
};
