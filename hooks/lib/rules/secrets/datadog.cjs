module.exports = [
  {
    id: "datadog-access-token", name: "Datadog Access Token", type: "secret", severity: "high",
    keywords: ["datadog"], regex: /datadog[\s\S]{0,20}[=\s'"]{0,5}([a-z0-9]{40})/i, entropy: 0, allowlist: [],
  },
];
