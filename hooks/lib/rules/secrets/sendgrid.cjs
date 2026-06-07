module.exports = [
  {
    id: "sendgrid-api-token", name: "SendGrid API Token", type: "secret", severity: "high",
    keywords: ["SG."], regex: /\b(SG\.[a-z0-9=_\-\.]{66,})\b/i, entropy: 2, allowlist: [],
  },
];
