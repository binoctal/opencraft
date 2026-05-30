const path = require("path");
const { dirExists } = require("../utils.cjs");

function detectAdapters(cwd) {
  const adapters = [];

  if (dirExists(path.join(cwd, "openspec"))) {
    adapters.push(require("./openspec.cjs"));
  }

  // Git as fallback
  if (adapters.length === 0) {
    adapters.push(require("./git.cjs"));
  }

  return adapters;
}

module.exports = { detectAdapters };
