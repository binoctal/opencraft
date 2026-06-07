module.exports = [
  {
    id: "aws-access-token",
    type: "secret",
    name: "AWS Access Key",
    severity: "critical",
    keywords: ["A3T", "AKIA", "ASIA", "ABIA", "ACCA"],
    regex: /\b((?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16})\b/,
    entropy: 3,
    allowlist: [/EXAMPLE$/],
  },
];
