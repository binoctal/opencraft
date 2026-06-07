module.exports = [
  {
    id: "slack-bot-token", name: "Slack Bot Token", type: "secret", severity: "critical",
    keywords: ["xoxb-"], regex: /xoxb-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/, entropy: 3, allowlist: [],
  },
  {
    id: "slack-user-token", name: "Slack User Token", type: "secret", severity: "critical",
    keywords: ["xoxp-", "xoxe-"], regex: /xox[pe](?:-[0-9]{10,13}){3}-[a-zA-Z0-9-]{28,34}/, entropy: 2, allowlist: [],
  },
  {
    id: "slack-app-token", name: "Slack App Token", type: "secret", severity: "high",
    keywords: ["xapp-"], regex: /xapp-\d-[A-Z0-9]+-\d+-[a-z0-9]+/i, entropy: 2, allowlist: [],
  },
  {
    id: "slack-webhook", name: "Slack Webhook URL", type: "secret", severity: "high",
    keywords: ["hooks.slack.com"], regex: /hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9+/]{43,56}/, entropy: 0, allowlist: [],
  },
];
