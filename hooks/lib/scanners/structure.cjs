const KNOWN_TEST_DIRS = new Set(["test", "tests", "__tests__", "spec", "specs"]);
const KNOWN_SRC_DIRS = new Set(["src", "lib", "app", "packages", "cmd", "pkg", "internal"]);

function measureFunctionLengths(content) {
  const lines = content.split("\n");
  const lengths = [];
  const fnStartRe = /(?:export\s+)?(?:async\s+)?(?:function|def)\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>\s*\{/g;

  for (let i = 0; i < lines.length; i++) {
    fnStartRe.lastIndex = 0;
    if (!fnStartRe.test(lines[i])) continue;

    let depth = 0, started = false, end = i;
    for (let j = i; j < lines.length && j < i + 200; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") { depth++; started = true; }
        if (ch === "}") { depth--; }
      }
      end = j;
      if (started && depth <= 0) break;
    }
    lengths.push(end - i + 1);
  }
  return lengths;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function detectDirs(files) {
  const dirs = {};
  for (const f of files) {
    const parts = f.relPath.split(/[/\\]/);
    if (parts.length > 1) {
      const d = parts[0];
      dirs[d] = (dirs[d] || 0) + 1;
    }
  }

  let testDir = null, srcDir = null;
  for (const d of Object.keys(dirs)) {
    if (!testDir && KNOWN_TEST_DIRS.has(d.toLowerCase())) testDir = d;
    if (!srcDir && KNOWN_SRC_DIRS.has(d.toLowerCase())) srcDir = d;
  }
  return { testDir, srcDir };
}

function detectExportStyle(files) {
  let named = 0, default_ = 0;
  for (const f of files) {
    if (/export\s+default\s/.test(f.content)) default_++;
    if (/export\s+(?:function|const|let|var|class|interface|type|\{)/.test(f.content)) named++;
  }
  if (named === 0 && default_ === 0) return null;
  if (named > 0 && default_ === 0) return "named";
  if (default_ > 0 && named === 0) return "default";
  if (named > default_) return "named";
  return "mixed";
}

function scan(files) {
  const fnLengths = [];
  const fileLengths = [];

  for (const f of files) {
    const lineCount = f.content.split("\n").length;
    fileLengths.push(lineCount);
    fnLengths.push(...measureFunctionLengths(f.content));
  }

  const sortedFn = [...fnLengths].sort((a, b) => a - b);
  const avgFn = sortedFn.length > 0
    ? Math.round(sortedFn.reduce((a, b) => a + b, 0) / sortedFn.length)
    : 0;
  const avgFile = fileLengths.length > 0
    ? Math.round(fileLengths.reduce((a, b) => a + b, 0) / fileLengths.length)
    : 0;
  const maxFile = fileLengths.length > 0 ? Math.max(...fileLengths) : 0;

  const { testDir, srcDir } = detectDirs(files);
  const exportStyle = detectExportStyle(files);

  return {
    structure: {
      avgFnLength: avgFn,
      p50: percentile(sortedFn, 50),
      p75: percentile(sortedFn, 75),
      p90: percentile(sortedFn, 90),
      avgFileLength: avgFile,
      maxFileLength: maxFile,
      testDir,
      srcDir,
      exportStyle,
    },
  };
}

module.exports = { scan, measureFunctionLengths, percentile, detectDirs, detectExportStyle };
