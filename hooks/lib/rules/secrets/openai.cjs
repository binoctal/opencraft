module.exports = [
  {
    id: "openai-key", name: "OpenAI API Key", type: "secret", severity: "critical",
    keywords: ["sk-", "openai"], regex: /sk-[a-zA-Z0-9]{48}/, entropy: 0, allowlist: [],
  },
  {
    id: "openai-project-key", name: "OpenAI Project Key", type: "secret", severity: "critical",
    keywords: ["sk-proj-"], regex: /sk-proj-[a-zA-Z0-9_-]{40,}/, entropy: 0, allowlist: [],
  },
];
