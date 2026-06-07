const LIBRARY_CATEGORIES = {
  stateManagement: [
    { imports: ["zustand"], name: "Zustand" },
    { imports: ["redux", "@reduxjs/toolkit", "@reduxjs"], name: "Redux" },
    { imports: ["mobx"], name: "MobX" },
    { imports: ["recoil"], name: "Recoil" },
    { imports: ["jotai"], name: "Jotai" },
    { imports: ["valtio"], name: "Valtio" },
    { imports: ["pinia"], name: "Pinia" },
    { imports: ["vuex"], name: "Vuex" },
  ],
  api: [
    { imports: ["@tanstack/react-query", "@tanstack/vue-query", "react-query"], name: "react-query" },
    { imports: ["swr"], name: "SWR" },
    { imports: ["axios"], name: "Axios" },
    { imports: ["ky"], name: "ky" },
    { imports: ["got"], name: "got" },
  ],
  testing: [
    { imports: ["vitest"], name: "Vitest" },
    { imports: ["jest"], name: "Jest" },
    { imports: ["mocha"], name: "Mocha" },
    { imports: ["pytest"], name: "pytest" },
    { imports: ["node:test"], name: "node:test" },
    { imports: ["@testing-library"], name: "Testing Library" },
  ],
  styling: [
    { imports: ["tailwindcss"], name: "Tailwind CSS" },
    { imports: ["styled-components"], name: "styled-components" },
    { imports: ["@emotion"], name: "Emotion" },
    { imports: ["@vanilla-extract"], name: "Vanilla Extract" },
  ],
};

function detectLibraryCategory(files, category) {
  const libs = LIBRARY_CATEGORIES[category] || [];
  for (const lib of libs) {
    for (const imp of lib.imports) {
      for (const f of files) {
        if (f.content.includes(imp)) return lib.name;
      }
    }
  }
  return null;
}

function detectErrorHandling(files) {
  let tryCatch = 0, result = 0, either = 0;
  for (const f of files) {
    if (/try\s*\{/.test(f.content)) tryCatch++;
    if (/Result[<[]/.test(f.content) || /\.ok\b/.test(f.content) || /from ['"]neverthrow['"]/.test(f.content)) result++;
    if (/Either[<[]/.test(f.content) || /\.isLeft\b/.test(f.content) || /from ['"]fp-ts\/Either['"]/.test(f.content)) either++;
  }
  if (result > tryCatch && result >= either) return "Result";
  if (either > 0 && either >= tryCatch) return "Either";
  if (tryCatch > 0) return "try/catch";
  return null;
}

function scan(files) {
  return {
    patterns: {
      errorHandling: detectErrorHandling(files),
      stateManagement: detectLibraryCategory(files, "stateManagement"),
      apiCalls: detectLibraryCategory(files, "api"),
      testing: detectLibraryCategory(files, "testing"),
      styling: detectLibraryCategory(files, "styling"),
    },
  };
}

module.exports = { scan, detectLibraryCategory, detectErrorHandling };
