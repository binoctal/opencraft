module.exports = [
  {
    id: "sentry-user-token", name: "Sentry User Token", type: "secret", severity: "high",
    keywords: ["sntryu_"], regex: /\bsntryu_[a-f0-9]{64}\b/, entropy: 3.5, allowlist: [],
  },
];
