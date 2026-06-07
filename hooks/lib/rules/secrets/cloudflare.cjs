module.exports = [
  {
    id: "cloudflare-origin-ca-key",
    type: "secret",
    name: "Cloudflare Origin CA Key",
    severity: "critical",
    keywords: ["v1.0-"],
    regex: /\b(v1\.0-[a-f0-9]{24}-[a-f0-9]{146})\b/,
    entropy: 2,
    allowlist: [],
  },
  {
    id: "cloudflare-global-api-key",
    type: "secret",
    name: "Cloudflare Global API Key",
    severity: "high",
    keywords: ["cloudflare"],
    regex: /cloudflare[\s\S]{0,20}[=\s'"]{0,5}([a-f0-9]{37})/i,
    entropy: 2,
    allowlist: [],
  },
];
