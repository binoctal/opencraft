const path = require("path");
const DEPENDENCY_FILES = new Set([
  "package.json", "go.mod", "go.sum", "requirements.txt", "pyproject.toml",
  "Cargo.toml", "Gemfile", "composer.json", "pom.xml", "build.gradle",
  "build.gradle.kts", "pubspec.yaml",
]);

module.exports = [
  {
    id: "deps-changed",
    name: "Dependency File Changed",
    type: "deps",
    severity: "medium",
    check: (ctx) => {
      const filePath = ctx.input?.tool_input?.file_path || "";
      const base = path.basename(filePath);
      if (DEPENDENCY_FILES.has(base)) {
        return { blocked: false, message: `[opencraft] 📦 dependency file changed: ${base}. Review for security.` };
      }
      return { blocked: false };
    },
  },
];
