const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { scan } = require("../hooks/lib/scanners/patterns.cjs");

describe("patterns scanner", () => {
  it("detects try/catch error handling", () => {
    const files = [
      { relPath: "src/api.ts", content: "try { await fetch(url); } catch (e) { handleError(e); }", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.patterns.errorHandling, "try/catch");
  });

  it("detects Result type pattern", () => {
    const files = [
      { relPath: "src/result.ts", content: "function parse(): Result<User, Error> { return ok(user); }", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.patterns.errorHandling, "Result");
  });

  it("detects state management library", () => {
    const files = [
      { relPath: "src/store.ts", content: "import { create } from 'zustand';", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.patterns.stateManagement, "Zustand");
  });

  it("detects testing framework", () => {
    const files = [
      { relPath: "test/app.test.ts", content: "import { describe, it } from 'vitest';", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.patterns.testing, "Vitest");
  });

  it("detects styling approach", () => {
    const files = [
      { relPath: "src/app.tsx", content: "import 'tailwindcss';", ext: ".tsx" },
    ];
    const result = scan(files);
    assert.equal(result.patterns.styling, "Tailwind CSS");
  });

  it("detects API library", () => {
    const files = [
      { relPath: "src/hooks.ts", content: "import { useQuery } from '@tanstack/react-query';", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.patterns.apiCalls, "react-query");
  });

  it("returns null for undetected categories", () => {
    const files = [
      { relPath: "src/plain.ts", content: "const x = 1;", ext: ".ts" },
    ];
    const result = scan(files);
    assert.equal(result.patterns.errorHandling, null);
    assert.equal(result.patterns.stateManagement, null);
  });

  it("handles empty file list", () => {
    const result = scan([]);
    assert.equal(result.patterns.errorHandling, null);
  });
});
