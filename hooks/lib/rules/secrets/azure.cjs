module.exports = [
  {
    id: "azure-ad-client-secret",
    type: "secret",
    name: "Azure AD Client Secret",
    severity: "critical",
    keywords: ["Q~"],
    regex: /(?:^|[\\'"\x60\s>=:(,)"])([a-zA-Z0-9_~.]{3}\dQ~[a-zA-Z0-9_~.-]{31,34})(?:$|[\\'"\x60\s<),])/,
    entropy: 3,
    allowlist: [],
  },
];
