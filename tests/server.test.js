process.env.NODE_ENV = "test"

const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { createApp, validatePolicy, sanitizePolicy } = require("../app/server")

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

function request(server, route, { method = "GET", body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body)
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: server.address().port,
        path: route,
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers
        }
      },
      (res) => {
        let data = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => (data += chunk))
        res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }))
      }
    )
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function waitForJob(server, jobId, { timeoutMs = 3000 } = {}) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    async function poll() {
      const res = await request(server, `/api/deployments/${jobId}`)
      if (res.statusCode !== 200) {
        reject(new Error(`job lookup failed: ${res.statusCode}`))
        return
      }
      const job = JSON.parse(res.body)
      if (job.status === "succeeded" || job.status === "failed") {
        resolve(job)
        return
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("timed out waiting for job"))
        return
      }
      setTimeout(poll, 25)
    }
    poll().catch(reject)
  })
}

function tempHistoryFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cadf-history-"))
  return { dir, filePath: path.join(dir, "deployments.json") }
}

function buildApp(overrides = {}) {
  const { dir, filePath } = tempHistoryFile()
  const app = createApp({
    historyFile: filePath,
    disableRateLimit: true,
    disableRequestLogging: true,
    apiKey: "",
    deployFn: async ({ policy, dryRun, onLog }) => {
      onLog("Reading policy...")
      onLog("Deployment successful")
      return {
        selected_cloud: "aws",
        status: dryRun ? "dry run successful" : "deployment successful",
        namespace: "aws",
        mode: "local-simulation",
        image: "cloud-demo:local",
        dry_run: dryRun,
        policy,
        logs: []
      }
    },
    ...overrides
  })
  return { app, historyDir: dir, historyFile: filePath }
}

test("GET / serves the dashboard HTML", async () => {
  const { app, historyDir } = buildApp()
  const server = await listen(app)
  try {
    const res = await request(server, "/")
    assert.equal(res.statusCode, 200)
    assert.match(String(res.headers["content-type"]), /text\/html/)
    assert.match(res.body, /Cloud-Agnostic Deployment Framework/)
  } finally {
    server.close()
    fs.rmSync(historyDir, { recursive: true, force: true })
  }
})

test("GET /health returns running status", async () => {
  const { app, historyDir } = buildApp()
  const server = await listen(app)
  try {
    const res = await request(server, "/health")
    assert.equal(res.statusCode, 200)
    assert.deepEqual(JSON.parse(res.body), { status: "running" })
  } finally {
    server.close()
    fs.rmSync(historyDir, { recursive: true, force: true })
  }
})

test("GET /api/providers returns catalog and SLA options", async () => {
  const { app, historyDir } = buildApp()
  const server = await listen(app)
  try {
    const res = await request(server, "/api/providers")
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.ok(body.providers.aws)
    assert.ok(body.providers.azure)
    assert.ok(body.providers.gcp)
    assert.ok(Array.isArray(body.sla_options))
    assert.equal(body.auth_required, false)
  } finally {
    server.close()
    fs.rmSync(historyDir, { recursive: true, force: true })
  }
})

test("POST /api/policy/evaluate explains the decision", async () => {
  const { app, historyDir } = buildApp()
  const server = await listen(app)
  try {
    const res = await request(server, "/api/policy/evaluate", {
      method: "POST",
      body: { cost_preference: "low", sla_requirement: "99.95" }
    })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.equal(body.selected_cloud, "aws")
    assert.ok(body.scores.length > 0)
    assert.ok(body.explanation.length > 0)
  } finally {
    server.close()
    fs.rmSync(historyDir, { recursive: true, force: true })
  }
})

test("POST /deploy enqueues a job and the job completes", async () => {
  const { app, historyDir, historyFile } = buildApp()
  const server = await listen(app)
  try {
    const res = await request(server, "/deploy", {
      method: "POST",
      body: { preferred_cloud: "aws", cost_preference: "low", sla_requirement: "99.99", dry_run: false }
    })

    assert.equal(res.statusCode, 202)
    const body = JSON.parse(res.body)
    assert.ok(body.job_id)
    assert.equal(body.selected_cloud, "aws")
    assert.equal(body.status, "queued")

    const job = await waitForJob(server, body.job_id)
    assert.equal(job.status, "succeeded")
    assert.equal(job.selected_cloud, "aws")
    assert.ok(job.logs.length > 0)

    // history endpoint lists it without heavy fields
    const list = await request(server, "/api/deployments")
    const items = JSON.parse(list.body).deployments
    assert.ok(items.some((item) => item.id === body.job_id))
    assert.equal(items[0].logs, undefined)

    // persisted to disk
    const persisted = JSON.parse(fs.readFileSync(historyFile, "utf8"))
    assert.ok(persisted.some((item) => item.id === body.job_id))
  } finally {
    server.close()
    fs.rmSync(historyDir, { recursive: true, force: true })
  }
})

test("POST /deploy validates the policy", async () => {
  const { app, historyDir } = buildApp()
  const server = await listen(app)
  try {
    const missing = await request(server, "/deploy", { method: "POST", body: { preferred_cloud: "aws" } })
    assert.equal(missing.statusCode, 400)
    assert.match(JSON.parse(missing.body).error, /sla_requirement is required/)

    const bad = await request(server, "/deploy", { method: "POST", body: { sla_requirement: "150" } })
    assert.equal(bad.statusCode, 400)
    assert.match(JSON.parse(bad.body).error, /between 90 and 99.999/)

    const badCloud = await request(server, "/deploy", {
      method: "POST",
      body: { preferred_cloud: "digitalocean", sla_requirement: "99.95" }
    })
    assert.equal(badCloud.statusCode, 400)
    assert.match(JSON.parse(badCloud.body).error, /preferred_cloud/)
  } finally {
    server.close()
    fs.rmSync(historyDir, { recursive: true, force: true })
  }
})

test("POST /deploy requires the API key when configured", async () => {
  const { app, historyDir } = buildApp({ apiKey: "secret-key" })
  const server = await listen(app)
  try {
    const denied = await request(server, "/deploy", {
      method: "POST",
      body: { sla_requirement: "99.95" }
    })
    assert.equal(denied.statusCode, 401)

    const allowed = await request(server, "/deploy", {
      method: "POST",
      body: { sla_requirement: "99.95" },
      headers: { "x-api-key": "secret-key" }
    })
    assert.equal(allowed.statusCode, 202)
  } finally {
    server.close()
    fs.rmSync(historyDir, { recursive: true, force: true })
  }
})

test("failed deployments are reported and persisted", async () => {
  const { app, historyDir } = buildApp({
    deployFn: async () => {
      throw new Error("docker daemon not running")
    }
  })
  const server = await listen(app)
  try {
    const res = await request(server, "/deploy", { method: "POST", body: { sla_requirement: "99.95" } })
    const body = JSON.parse(res.body)
    const job = await waitForJob(server, body.job_id)
    assert.equal(job.status, "failed")
    assert.match(job.error, /docker daemon not running/)
  } finally {
    server.close()
    fs.rmSync(historyDir, { recursive: true, force: true })
  }
})

test("unknown routes return JSON 404", async () => {
  const { app, historyDir } = buildApp()
  const server = await listen(app)
  try {
    const res = await request(server, "/nope")
    assert.equal(res.statusCode, 404)
    assert.deepEqual(JSON.parse(res.body), { error: "not found" })
  } finally {
    server.close()
    fs.rmSync(historyDir, { recursive: true, force: true })
  }
})

test("validatePolicy and sanitizePolicy unit checks", () => {
  assert.equal(validatePolicy(sanitizePolicy({ sla_requirement: "99.95" })), null)
  assert.match(validatePolicy(sanitizePolicy({})), /required/)
  assert.match(validatePolicy(sanitizePolicy({ sla_requirement: "abc" })), /between/)
  assert.match(validatePolicy(sanitizePolicy({ sla_requirement: "99.95", cost_preference: "cheap" })), /cost_preference/)
  assert.deepEqual(sanitizePolicy({ preferred_cloud: " AWS " }).preferred_cloud, "aws")
})
