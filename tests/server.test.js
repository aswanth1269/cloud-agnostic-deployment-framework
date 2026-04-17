const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { startServer } = require("../app/server")

function request(server, route) {
  return new Promise((resolve, reject) => {
    const address = server.address()

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: route,
        method: "GET"
      },
      (res) => {
        let body = ""

        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          body += chunk
        })
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          })
        })
      }
    )

    req.on("error", reject)
    req.end()
  })
}

function requestJson(server, route, method, body) {
  return new Promise((resolve, reject) => {
    const address = server.address()
    const payload = JSON.stringify(body)

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: route,
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let responseBody = ""

        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          responseBody += chunk
        })
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseBody
          })
        })
      }
    )

    req.on("error", reject)
    req.write(payload)
    req.end()
  })
}

test("GET / returns the HTML UI", async () => {
  const server = startServer(0)

  try {
    const res = await request(server, "/")
    assert.equal(res.statusCode, 200)
    assert.match(String(res.headers["content-type"] || ""), /text\/html/)
    assert.match(res.body, /Policy-Driven Cloud Orchestration/)
  } finally {
    server.close()
  }
})

test("GET /health returns running status JSON", async () => {
  const server = startServer(0)

  try {
    const res = await request(server, "/health")
    assert.equal(res.statusCode, 200)
    assert.match(String(res.headers["content-type"] || ""), /application\/json/)
    assert.deepEqual(JSON.parse(res.body), { status: "running" })
  } finally {
    server.close()
  }
})

test("POST /deploy writes policy and returns deployment result", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud-deploy-api-"))
  const policyPath = path.join(tempDir, "policy.json")
  const deploymentCalls = []

  const server = startServer(0, {
    policyPath,
    deployFn: async ({ policyPath: writtenPolicyPath }) => {
      deploymentCalls.push(writtenPolicyPath)
      return {
        selected_cloud: "aws",
        status: "deployment successful",
        logs: ["Policy selected AWS deployment", "Selected cloud: AWS", "Deployment successful"]
      }
    }
  })

  try {
    const res = await requestJson(server, "/deploy", "POST", {
      preferred_cloud: "azure",
      cost_preference: "low",
      latency_requirement: "high",
      sla_requirement: "99.95"
    })

    assert.equal(res.statusCode, 200)
    assert.deepEqual(JSON.parse(res.body), {
      selected_cloud: "aws",
      status: "deployment successful",
      logs: ["Policy selected AWS deployment", "Selected cloud: AWS", "Deployment successful"]
    })
    assert.equal(deploymentCalls.length, 1)
    assert.equal(deploymentCalls[0], policyPath)
    assert.deepEqual(JSON.parse(fs.readFileSync(policyPath, "utf8")), {
      deployment_policy: {
        preferred_cloud: "azure",
        cost_preference: "low",
        latency_requirement: "high",
        sla_requirement: "99.95"
      }
    })
  } finally {
    server.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test("POST /deploy returns 400 when sla_requirement is missing", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud-deploy-api-missing-sla-"))
  const policyPath = path.join(tempDir, "policy.json")
  let deploymentTriggered = false

  const server = startServer(0, {
    policyPath,
    deployFn: async () => {
      deploymentTriggered = true
      return {
        selected_cloud: "aws",
        status: "deployment successful",
        logs: []
      }
    }
  })

  try {
    const res = await requestJson(server, "/deploy", "POST", {
      preferred_cloud: "azure",
      cost_preference: "low",
      latency_requirement: "high"
    })

    assert.equal(res.statusCode, 400)
    assert.deepEqual(JSON.parse(res.body), {
      selected_cloud: null,
      status: "deployment failed",
      error: "sla_requirement is required"
    })
    assert.equal(deploymentTriggered, false)
    assert.equal(fs.existsSync(policyPath), false)
  } finally {
    server.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test("POST /deploy returns 400 when sla_requirement is invalid", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud-deploy-api-invalid-sla-"))
  const policyPath = path.join(tempDir, "policy.json")
  let deploymentTriggered = false

  const server = startServer(0, {
    policyPath,
    deployFn: async () => {
      deploymentTriggered = true
      return {
        selected_cloud: "aws",
        status: "deployment successful",
        logs: []
      }
    }
  })

  try {
    const res = await requestJson(server, "/deploy", "POST", {
      preferred_cloud: "azure",
      cost_preference: "low",
      latency_requirement: "high",
      sla_requirement: "99.80"
    })

    assert.equal(res.statusCode, 400)
    assert.deepEqual(JSON.parse(res.body), {
      selected_cloud: null,
      status: "deployment failed",
      error: "sla_requirement must be one of: 99.00, 99.50, 99.90, 99.95, 99.99"
    })
    assert.equal(deploymentTriggered, false)
    assert.equal(fs.existsSync(policyPath), false)
  } finally {
    server.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
