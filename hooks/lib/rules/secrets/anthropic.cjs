module.exports = [
  {
    id: "anthropic-api-key",
    name: "Anthropic API Key",
    type: "secret",
    severity: "critical",
    keywords: ["sk-ant-api03-"],
    regex: /\b(sk-ant-api03-[a-zA-Z0-9_-]{93}AA)\b/,
    entropy: 0,
    allowlist: [],
  },
  {
    id: "anthropic-admin-api-key",
    name: "Anthropic Admin API Key",
    type: "secret",
    severity: "critical",
    keywords: ["sk-ant-admin01-"],
    regex: /\b(sk-ant-admin01-[a-zA-Z0-9_-]{93}AA)\b/,
    entropy: 0,
    allowlist: [],
  },
];
