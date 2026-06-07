const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const { scan } = require("../hooks/lib/scanners/imports.cjs");

describe("imports scanner", () => {
  it("detects path alias from tsconfig paths", () => {
    const tmp = fs.mkdtempSync("/tmp/opencraft-test-");
    fs.writeFileSync(path.join(tmp, "tsconfig.json"), JSON.stringify({
      compilerOptions: { paths: { "@/*": ["./src/*"] } },
    }));
    const files = [
      { relPath: "src/a.ts", content: "import { x } from '@/utils';", ext: ".ts" },
    ];
    const result = scan(files, tmp);
    assert.ok(result.imports.aliases.length > 0);
    assert.equal(result.imports.aliases[0].alias, "@/*");
    fs.rmSync(tmp, { recursive: true });
  });

  it("detects absolute import preference", () => {
    const files = [
      { relPath: "src/a.ts", content: "import { x } from '@/utils';\nimport { y } from '@/api';", ext: ".ts" },
      { relPath: "src/b.ts", content: "import { z } from './helper';", ext: ".ts" },
    ];
    const result = scan(files, process.cwd());
    assert.equal(result.imports.style, "absolute");
  });

  it("detects relative import preference", () => {
    const files = [
      { relPath: "src/a.ts", content: "import { x } from './utils';\nimport { y } from './api';", ext: ".ts" },
    ];
    const result = scan(files, process.cwd());
    assert.equal(result.imports.style, "relative");
  });

  it("detects barrel exports", () => {
    const files = [
      { relPath: "src/index.ts", content: "export { getUser } from './user';\nexport { createUser } from './create';", ext: ".ts" },
    ];
    const result = scan(files, process.cwd());
    assert.equal(result.imports.barrelExports, true);
  });

  it("returns nulls for empty input", () => {
    const result = scan([], process.cwd());
    assert.equal(result.imports.style, null);
    assert.equal(result.imports.barrelExports, false);
  });
});
