module.exports = [
  {
    id: "npm-access-token", name: "NPM Access Token", type: "secret", severity: "critical",
    keywords: ["npm_"], regex: /\b(npm_[a-z0-9]{36})\b/i, entropy: 2, allowlist: [],
  },
];
