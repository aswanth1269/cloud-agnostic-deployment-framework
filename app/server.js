const fs = require("fs")
const path = require("path")
const express = require("express")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const pino = require("pino")
const pinoHttp = require("pino-http")

const config = require("./config")
const { HistoryStore } = require("./historyStore")
const { JobManager } = require("./jobs")
const { evaluate, loadCatalog } = require("../policy-engine/cloudSelector")
const { deploy } = require("../deployment/deploy")

const VALID_CLOUDS = new Set(["", "aws", "azure", "gcp"])
const VALID_LEVELS = new Set(["", "low", "medium", "high"])

/**
 * Normalizes an incoming policy payload to lowercase trimmed strings.
 */
function sanitizePolicy(body = {}) {
  return {
    preferred_cloud: String(body.preferred_cloud || "").toLowerCase().trim(),
    cost_preference: String(body.cost_preference || "").toLowerCase().trim(),
    latency_requirement: String(body.latency_requirement || "").toLowerCase().trim(),
    sla_requirement: String(body.sla_requirement || "").trim()
  }
}

/**
 * Validates a sanitized policy. Returns an error string or null.
 */
function validatePolicy(policy) {
  if (!policy.sla_requirement) {
    return "sla_requirement is required"
  }

  const sla = Number(policy.sla_requirement)
  if (!Number.isFinite(sla) || sla < 90 || sla >= 100) {
    return "sla_requirement must be a number between 90 and 99.999"
  }

  if (!VALID_CLOUDS.has(policy.preferred_cloud)) {
    return "preferred_cloud must be one of: aws, azure, gcp"
  }

  if (!VALID_LEVELS.has(policy.cost_preference)) {
    return "cost_preference must be one of: low, medium, high"
  }

  if (!VALID_LEVELS.has(policy.latency_requirement)) {
    return "latency_requirement must be one of: low, medium, high"
  }

  return null
}

/**
 * Builds the Express app. All collaborators are injectable for testing.
 * @param {object} options - { deployFn, historyFile, apiKey, corsOrigin,
 *                             dryRunDefault, disableRateLimit, logger }
 */
function createApp(options = {}) {
  const logger = options.logger || pino({ level: config.logLevel })
  const apiKey = options.apiKey !== undefined ? options.apiKey : config.apiKey
  const corsOrigin = options.corsOrigin !== undefined ? options.corsOrigin : config.corsOrigin
  const dryRunDefault = options.dryRunDefault !== undefined ? options.dryRunDefault : config.dryRunDefault

  const historyStore = options.historyStore || new HistoryStore({
    filePath: options.historyFile !== undefined ? options.historyFile : config.historyFile,
    maxEntries: config.maxHistoryEntries,
    logger
  })

  const jobManager = new JobManager({
    deployFn: options.deployFn || deploy,
    historyStore,
    logger
  })

  const app = express()
  app.disable("x-powered-by")

  // --- Security middleware -------------------------------------------------
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"]
      }
    }
  }))

  if (corsOrigin) {
    app.use((req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin)
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Key")
      if (req.method === "OPTIONS") {
        res.sendStatus(204)
        return
      }
      next()
    })
  }

  if (options.disableRateLimit !== true) {
    app.use(rateLimit({ ...config.apiRateLimit, standardHeaders: true, legacyHeaders: false }))
  }

  if (options.disableRequestLogging !== true && process.env.NODE_ENV !== "test") {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }))
  }

  app.use(express.json({ limit: "10kb" }))

  function requireApiKey(req, res, next) {
    if (!apiKey) {
      next()
      return
    }
    if (req.get("x-api-key") === apiKey) {
      next()
      return
    }
    res.status(401).json({ error: "invalid or missing API key (x-api-key header)" })
  }

  // --- Routes --------------------------------------------------------------
  app.get("/health", (_req, res) => {
    res.json({ status: "running" })
  })

  app.get("/api/providers", (_req, res) => {
    const catalog = loadCatalog()
    res.json({
      default_provider: catalog.default_provider,
      providers: catalog.providers,
      sla_options: ["99.00", "99.50", "99.90", "99.95", "99.99"],
      auth_required: Boolean(apiKey)
    })
  })

  app.post("/api/policy/evaluate", (req, res) => {
    const policy = sanitizePolicy(req.body)
    const validationError = validatePolicy(policy)
    if (validationError) {
      res.status(400).json({ error: validationError })
      return
    }

    const evaluation = evaluate(policy)
    res.json({
      selected_cloud: evaluation.selected,
      eligible: evaluation.eligible,
      scores: evaluation.scores,
      explanation: evaluation.explanation
    })
  })

  const deployLimiter = options.disableRateLimit === true
    ? (_req, _res, next) => next()
    : rateLimit({ ...config.deployRateLimit, standardHeaders: true, legacyHeaders: false })

  app.post("/deploy", deployLimiter, requireApiKey, (req, res) => {
    const policy = sanitizePolicy(req.body)
    const validationError = validatePolicy(policy)
    if (validationError) {
      res.status(400).json({
        selected_cloud: null,
        status: "deployment failed",
        error: validationError
      })
      return
    }

    const evaluation = evaluate(policy)
    const dryRun = req.body.dry_run !== undefined ? Boolean(req.body.dry_run) : dryRunDefault

    const job = jobManager.create({
      policy,
      dryRun,
      selectedCloud: evaluation.selected
    })

    res.status(202).json({
      job_id: job.id,
      status: job.status,
      selected_cloud: evaluation.selected,
      dry_run: job.dry_run,
      job_url: `/api/deployments/${job.id}`,
      logs_url: `/api/deployments/${job.id}/logs`
    })
  })

  app.get("/api/deployments", (_req, res) => {
    const items = jobManager.list().map((entry) => {
      const { logs, policy: _policy, ...rest } = entry
      return { ...rest, log_count: Array.isArray(logs) ? logs.length : entry.log_count || 0 }
    })
    res.json({ deployments: items })
  })

  app.get("/api/deployments/:id", (req, res) => {
    const job = jobManager.get(req.params.id)
    if (!job) {
      res.status(404).json({ error: "deployment not found" })
      return
    }
    res.json(job)
  })

  // Server-Sent Events: replays existing log lines, then streams live ones.
  app.get("/api/deployments/:id/logs", (req, res) => {
    const job = jobManager.get(req.params.id)
    if (!job) {
      res.status(404).json({ error: "deployment not found" })
      return
    }

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    for (const line of job.logs || []) {
      res.write(`event: log\ndata: ${JSON.stringify({ type: "log", line })}\n\n`)
    }

    if (job.status === "succeeded" || job.status === "failed") {
      res.write(`event: end\ndata: ${JSON.stringify({ type: "end", status: job.status })}\n\n`)
      res.end()
      return
    }

    jobManager.subscribe(job.id, res)
    req.on("close", () => jobManager.unsubscribe(job.id, res))
  })

  // --- Static dashboard ----------------------------------------------------
  // Serve the built React app (web/dist) when available; fall back to the
  // zero-build vanilla dashboard in app/public.
  const webDist = path.join(__dirname, "..", "web", "dist")
  const staticDir = fs.existsSync(path.join(webDist, "index.html")) ? webDist : path.join(__dirname, "public")
  app.use(express.static(staticDir))

  // --- Fallbacks -----------------------------------------------------------
  app.use((_req, res) => {
    res.status(404).json({ error: "not found" })
  })

  app.use((error, _req, res, _next) => {
    logger.error ? logger.error(error) : console.error(error)
    res.status(error.status || 500).json({ error: error.expose ? error.message : "internal server error" })
  })

  return app
}

function startServer(port = config.port, options = {}) {
  const app = createApp(options)
  return app.listen(port, function onListen() {
    const actualPort = this.address().port
    console.log("Cloud-Agnostic Deployment Framework")
    console.log(`Dashboard + API running on http://localhost:${actualPort}`)
    if (!config.apiKey) {
      console.log("WARNING: API_KEY is not set - POST /deploy is unauthenticated (dev mode)")
    }
  })
}

if (require.main === module) {
  startServer()
}

module.exports = {
  createApp,
  startServer,
  sanitizePolicy,
  validatePolicy
}
