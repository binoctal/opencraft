const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ciPath = require.resolve("../hooks/lib/ci-alignment.cjs");

describe("ci-alignment", () => {
  describe("normalize", () => {
    let normalize;
    beforeEach(() => { delete require.cache[ciPath]; ({ normalize } = require(ciPath)); });

    it("strips npx prefix", () => {
      assert.equal(normalize("npx vitest"), "vitest");
    });

    it("strips npm run prefix", () => {
      assert.equal(normalize("npm run test"), "test");
    });

    it("strips pnpm run prefix", () => {
      assert.equal(normalize("pnpm run build"), "build");
    });

    it("strips pnpm prefix", () => {
      assert.equal(normalize("pnpm test"), "test");
    });

    it("strips yarn prefix", () => {
      assert.equal(normalize("yarn lint"), "lint");
    });

    it("strips yarn run prefix", () => {
      assert.equal(normalize("yarn run test"), "test");
    });

    it("returns base command unchanged when no prefix", () => {
      assert.equal(normalize("vitest"), "vitest");
    });

    it("trims result", () => {
      assert.equal(normalize("  vitest  "), "vitest");
    });
  });

  describe("extractCICommands", () => {
    let extractCICommands;
    let tmpDir;

    beforeEach(() => {
      delete require.cache[ciPath];
      ({ extractCICommands } = require(ciPath));
      tmpDir = path.join(os.tmpdir(), `oc-ci-${Date.now()}`);
    });

    afterEach(() => {
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("returns empty result when .github/workflows does not exist", () => {
      const result = extractCICommands(tmpDir);
      assert.deepEqual(result, { verify: [], lint: [], build: [] });
    });

    it("extracts verify commands from CI YAML", () => {
      const wfDir = path.join(tmpDir, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, "ci.yml"), [
        "jobs:",
        "  test:",
        "    steps:",
        "      - npm run test",
        "      - npm run lint",
      ].join("\n"));

      const result = extractCICommands(tmpDir);
      assert.ok(result.verify.some(c => c.includes("npm run test")));
    });

    it("extracts lint commands", () => {
      const wfDir = path.join(tmpDir, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, "ci.yml"), [
        "steps:",
        "      - eslint src/",
        "      - prettier --check .",
      ].join("\n"));

      const result = extractCICommands(tmpDir);
      assert.ok(result.lint.some(c => c.includes("eslint")));
    });

    it("extracts build commands", () => {
      const wfDir = path.join(tmpDir, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, "ci.yml"), [
        "steps:",
        "      - npm run build",
      ].join("\n"));

      const result = extractCICommands(tmpDir);
      assert.ok(result.build.some(c => c.includes("npm run build")));
    });

    it("skips commands starting with $", () => {
      const wfDir = path.join(tmpDir, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, "ci.yml"), [
        "steps:",
        '      - ${{ secrets.KEY }}',
        "      - npm run test",
      ].join("\n"));

      const result = extractCICommands(tmpDir);
      assert.equal(result.verify.length, 1);
    });

    it("deduplicates commands", () => {
      const wfDir = path.join(tmpDir, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, "ci.yml"), [
        "steps:",
        "      - npm run test",
        "      - npm run test",
      ].join("\n"));

      const result = extractCICommands(tmpDir);
      assert.equal(result.verify.length, 1);
    });
  });

  describe("checkAlignment", () => {
    let checkAlignment;
    let tmpDir;

    beforeEach(() => {
      delete require.cache[ciPath];
      ({ checkAlignment } = require(ciPath));
      tmpDir = path.join(os.tmpdir(), `oc-align-${Date.now()}`);
    });

    afterEach(() => {
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("returns empty when no CI workflows", () => {
      const result = checkAlignment(tmpDir, { verify: ["vitest"], lint: [], build: [] });
      assert.deepEqual(result, []);
    });

    it("reports mismatch when CI has a command not in profile", () => {
      const wfDir = path.join(tmpDir, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, "ci.yml"), "steps:\n      - npm run test\n");

      delete require.cache[ciPath];
      ({ checkAlignment } = require(ciPath));
      const result = checkAlignment(tmpDir, { verify: ["go vet ./..."], lint: [], build: [] });
      assert.ok(result.length > 0);
      assert.equal(result[0].category, "verify");
    });

    it("returns empty when CI commands match profile", () => {
      const wfDir = path.join(tmpDir, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, "ci.yml"), "steps:\n      - npm run test\n");

      delete require.cache[ciPath];
      ({ checkAlignment } = require(ciPath));
      const result = checkAlignment(tmpDir, { verify: ["npm run test"], lint: [], build: [] });
      assert.deepEqual(result, []);
    });
  });
});
