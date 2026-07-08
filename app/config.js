const path = require("path")

// Load .env if present (no error if missing)
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true })

function envBool(value, fallback = false) {
  if (value === undefined || value === "") return fallback
  return String(value).toLowerCase() === "true"
}

const config = {
  port: Number(process.env.PORT) || 3000,
  logLevel: process.env.LOG_LEVEL || "info",

  // Security
  apiKey: process.env.API_KEY || "",
  corsOrigin: process.env.CORS_ORIGIN || "",

  // Deployment behavior
  dryRunDefault: envBool(process.env.DEPLOY_DRY_RUN, false),
  imageRegistry: process.env.IMAGE_REGISTRY || "",
  imageTag: process.env.IMAGE_TAG || "latest",

  // Persistence
  historyFile: process.env.HISTORY_FILE || path.join(__dirname, "..", "data", "deployments.json"),
  maxHistoryEntries: Number(process.env.MAX_HISTORY_ENTRIES) || 200,

  // Rate limits
  deployRateLimit: { windowMs: 60 * 1000, max: Number(process.env.DEPLOY_RATE_LIMIT) || 10 },
  apiRateLimit: { windowMs: 15 * 60 * 1000, max: Number(process.env.API_RATE_LIMIT) || 300 }
}

module.exports = config
