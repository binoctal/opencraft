module.exports = [
  {
    id: "mongodb-uri", name: "MongoDB Connection URI", type: "secret", severity: "high",
    keywords: ["mongodb"], regex: /mongodb(?:\+srv)?:\/\/[^\s'"]+/, entropy: 0,
    allowlist: [/mongodb:\/\/localhost/, /mongodb:\/\/127\.0\.0\.1/, /example\.com/],
  },
  {
    id: "postgres-uri", name: "PostgreSQL Connection URI", type: "secret", severity: "high",
    keywords: ["postgresql://", "postgres://"], regex: /(?:postgresql|postgres):\/\/[^\s'"]+/, entropy: 0,
    allowlist: [/localhost/, /127\.0\.0\.1/, /example\.com/],
  },
  {
    id: "mysql-uri", name: "MySQL Connection URI", type: "secret", severity: "high",
    keywords: ["mysql://"], regex: /mysql:\/\/[^\s'"]+/, entropy: 0,
    allowlist: [/localhost/, /127\.0\.0\.1/, /example\.com/],
  },
  {
    id: "redis-uri", name: "Redis Connection URI", type: "secret", severity: "medium",
    keywords: ["redis://", "rediss://"], regex: /redis[s]?:\/\/[^\s'"]+/, entropy: 0,
    allowlist: [/localhost/, /127\.0\.0\.1/, /example\.com/],
  },
];
