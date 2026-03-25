const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
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

test("GET / returns demo message", async () => {
  const server = startServer(0)

  try {
    const res = await request(server, "/")
    assert.equal(res.statusCode, 200)
    assert.equal(res.body, "Cloud Agnostic Deployment Framework Demo")
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
