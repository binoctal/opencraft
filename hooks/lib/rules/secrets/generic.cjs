module.exports = [
  {
    id: "generic-api-key", name: "Generic API Key", type: "secret", severity: "low",
    keywords: ["api_key", "apikey", "API_KEY", "api-key"],
    regex: /(?:api[_-]?key|apikey|API_KEY)\s*[=:]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/i,
    entropy: 3.5, allowlist: [/example/, /placeholder/, /your[_-]?/i, /REPLACE/i],
  },
];
