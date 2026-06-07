module.exports = [
  {
    id: "private-key", name: "Private Key", type: "secret", severity: "critical",
    keywords: ["-----BEGIN"], multiline: true,
    regex: /-----BEGIN[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----[\s\S-]{64,}?KEY(?: BLOCK)?-----/i,
    entropy: 0, allowlist: [],
  },
];
