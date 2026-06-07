module.exports = [
  {
    id: "stripe-access-token",
    name: "Stripe Access Token",
    type: "secret",
    severity: "critical",
    keywords: ["sk_test", "sk_live", "sk_prod", "rk_test", "rk_live", "rk_prod"],
    regex: /\b((?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{10,99})\b/,
    entropy: 2,
    allowlist: [],
  },
];
