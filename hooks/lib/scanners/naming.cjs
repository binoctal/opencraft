const { classifyCase } = require("../scan-utils.cjs");

const FN_DECL = /(?:export\s+)?(?:async\s+)?(?:function|def)\s+(\w+)/g;
const ARROW_FN = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>/g;
const CLASS_DECL = /(?:export\s+)?(?:default\s+)?(?:class|interface|type)\s+(\w+)/g;
const VAR_DECL = /(?:const|let|var)\s+(\w+)/g;

function extractIdentifiers(content) {
  const functions = [];
  const variables = [];
  const classes = [];
  let m;

  FN_DECL.lastIndex = 0;
  while ((m = FN_DECL.exec(content)) !== null) functions.push(m[1]);

  ARROW_FN.lastIndex = 0;
  while ((m = ARROW_FN.exec(content)) !== null) functions.push(m[1]);

  CLASS_DECL.lastIndex = 0;
  while ((m = CLASS_DECL.exec(content)) !== null) classes.push(m[1]);

  const fnSet = new Set(functions);
  VAR_DECL.lastIndex = 0;
  while ((m = VAR_DECL.exec(content)) !== null) {
    if (!fnSet.has(m[1])) variables.push(m[1]);
  }

  return { functions, variables, classes };
}

function dominantStyle(names) {
  if (names.length === 0) return { style: null, confidence: 0 };
  const counts = {};
  for (const n of names) {
    const s = classifyCase(n);
    if (s) counts[s] = (counts[s] || 0) + 1;
  }
  if (Object.keys(counts).length === 0) return { style: null, confidence: 0 };
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [style, count] = sorted[0];
  return { style, confidence: Math.round((count / names.length) * 100) };
}

function extractPrefixes(names) {
  const prefixes = {};
  for (const name of names) {
    const parts = name.replace(/([A-Z])/g, " $1").trim().split(/\s+/);
    if (parts.length >= 2) {
      const p = parts[0].toLowerCase();
      prefixes[p] = (prefixes[p] || 0) + 1;
    }
  }
  return Object.entries(prefixes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([p]) => p);
}

function detectTestPattern(files) {
  const patterns = {};
  for (const f of files) {
    if (f.relPath.includes(".test.")) patterns[".test"] = (patterns[".test"] || 0) + 1;
    if (f.relPath.includes(".spec.")) patterns[".spec"] = (patterns[".spec"] || 0) + 1;
    if (f.relPath.includes("__tests__")) patterns["__tests__"] = (patterns["__tests__"] || 0) + 1;
    if (f.relPath.includes("test/")) patterns["test/"] = (patterns["test/"] || 0) + 1;
  }
  const sorted = Object.entries(patterns).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

function scan(files) {
  const allFunctions = [];
  const allVariables = [];
  const allClasses = [];
  const fileNames = [];

  for (const f of files) {
    const ids = extractIdentifiers(f.content);
    allFunctions.push(...ids.functions);
    allVariables.push(...ids.variables);
    allClasses.push(...ids.classes);

    const baseName = f.relPath.split(/[/\\]/).pop().replace(/\.[^.]+$/, "");
    if (baseName && !baseName.startsWith(".") && baseName !== "index") {
      fileNames.push(baseName);
    }
  }

  const constants = allVariables.filter(v => /^[A-Z][A-Z0-9_]*$/.test(v) && v.includes("_"));
  const nonConstVars = allVariables.filter(v => !(/^[A-Z][A-Z0-9_]*$/.test(v) && v.includes("_")));

  const fnStyle = dominantStyle(allFunctions);
  const varStyle = dominantStyle(nonConstVars);
  const classStyle = dominantStyle(allClasses);
  const fileStyle = dominantStyle(fileNames);
  const constStyle = constants.length > 0
    ? { style: "UPPER_SNAKE_CASE", confidence: Math.min(100, Math.round((constants.length / Math.max(1, allVariables.length)) * 100)) }
    : { style: null, confidence: 0 };

  const prefixes = extractPrefixes(allFunctions);
  const testPattern = detectTestPattern(files);

  const confidences = [fnStyle.confidence, varStyle.confidence, fileStyle.confidence].filter(c => c > 0);
  const avgConfidence = confidences.length > 0
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : 0;

  return {
    naming: {
      functions: fnStyle.style,
      functionPrefixes: prefixes,
      variables: varStyle.style,
      constants: constStyle.style,
      classes: classStyle.style,
      files: fileStyle.style,
      testFiles: testPattern,
      confidence: avgConfidence,
    },
  };
}

module.exports = { scan, extractIdentifiers, dominantStyle, extractPrefixes };
