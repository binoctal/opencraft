module.exports = [
  {
    id: "pypi-token", name: "PyPI API Token", type: "secret", severity: "critical",
    keywords: ["pypi-"], regex: /pypi-AgEIcHb[a-zA-Z0-9\-_]{60,}/, entropy: 3, allowlist: [],
  },
];
