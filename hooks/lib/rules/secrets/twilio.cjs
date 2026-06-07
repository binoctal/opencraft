module.exports = [
  {
    id: "twilio-api-key", name: "Twilio API Key", type: "secret", severity: "critical",
    keywords: ["SK"], regex: /\bSK[0-9a-fA-F]{32}\b/, entropy: 3, allowlist: [],
  },
];
