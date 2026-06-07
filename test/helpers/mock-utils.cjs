const { mock } = require("node:test");
const path = require("path");

/**
 * Create a mock run() function that maps command prefixes to results.
 * First matching prefix wins. Unmatched commands return failure.
 */
function createMockRun(commandMap) {
  return function mockRun(cmd, opts) {
    for (const [prefix, result] of Object.entries(commandMap)) {
      if (cmd.startsWith(prefix)) {
        return { ok: result.ok !== false, stdout: result.stdout || "", stderr: result.stderr || "", code: result.code || 0 };
      }
    }
    return { ok: false, stdout: "", stderr: `unexpected command: ${cmd}`, code: 1 };
  };
}

/**
 * Load a module with utils.run mocked.
 * Clears require cache for both utils and the target module, patches run,
 * then requires the target fresh.
 *
 * Usage:
 *   const mod = withMockedRun({ 'git rev-parse': { ok: true, stdout: 'main' } }, require.resolve('../../hooks/lib/git-intel.cjs'));
 */
function withMockedRun(commandMap, modulePath) {
  const utilsPath = require.resolve("../../hooks/utils.cjs");

  // Clear caches
  delete require.cache[modulePath];
  delete require.cache[utilsPath];

  const utils = require(utilsPath);
  const mockFn = createMockRun(commandMap);
  mock.method(utils, "run", mockFn);

  return require(modulePath);
}

/**
 * Create mock fs methods for a virtual filesystem.
 * fileSystem: { '/path/to/file': 'content', '/path/to/dir': null }
 */
function createMockFs(fileSystem) {
  const entries = new Map(Object.entries(fileSystem));

  return {
    statSync(p) {
      const resolved = path.resolve(p);
      if (!entries.has(resolved)) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      const val = entries.get(resolved);
      return {
        isFile() { return val !== null && typeof val === "string"; },
        isDirectory() { return val === null; },
        size: typeof val === "string" ? val.length : 0,
      };
    },
    readFileSync(p, encoding) {
      const resolved = path.resolve(p);
      if (!entries.has(resolved)) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      const val = entries.get(resolved);
      if (val === null) {
        const err = new Error("EISDIR");
        err.code = "EISDIR";
        throw err;
      }
      return val;
    },
    readdirSync(p) {
      const resolved = path.resolve(p);
      const prefix = resolved.endsWith("/") ? resolved : resolved + "/";
      const dirents = [];
      const seen = new Set();
      for (const key of entries.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const name = rest.split("/")[0];
          if (name && !seen.has(name)) {
            seen.add(name);
            dirents.push(name);
          }
        }
      }
      if (dirents.length === 0 && !entries.has(resolved)) {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      return dirents;
    },
  };
}

module.exports = { createMockRun, withMockedRun, createMockFs };
