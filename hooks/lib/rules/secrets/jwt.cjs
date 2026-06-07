module.exports = [
  {
    id: "jwt-token", name: "JWT Token", type: "secret", severity: "high",
    keywords: ["eyJ"], regex: /eyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}/, entropy: 0, allowlist: [],
  },
];
