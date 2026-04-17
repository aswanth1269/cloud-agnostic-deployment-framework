const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { syncArgoApplicationNamespace } = require("../argocd/syncApplication")
const { syncArgoFromPolicy } = require("../deployment/syncArgoFromPolicy")

function withTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "argocd-sync-test-"))
}

test("syncArgoApplicationNamespace updates destination namespace", () => {
  const dir = withTempDir()
  const appPath = path.join(dir, "application.yaml")

  fs.writeFileSync(
    appPath,
    [
      "apiVersion: argoproj.io/v1alpha1",
      "kind: Application",
      "spec:",
      "  destination:",
      "    server: https://kubernetes.default.svc",
      "    namespace: aws",
      "  syncPolicy:",
      "    automated:",
      "      prune: true"
    ].join("\n"),
    "utf8"
  )

  try {
    const result = syncArgoApplicationNamespace("gcp", { appPath })
    assert.equal(result.updated, true)
    const updated = fs.readFileSync(appPath, "utf8")
    assert.match(updated, /namespace: gcp/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("syncArgoFromPolicy maps selected cloud to namespace", () => {
  const dir = withTempDir()
  const policyPath = path.join(dir, "policy.json")
  const appPath = path.join(dir, "application.yaml")

  fs.writeFileSync(
    policyPath,
    JSON.stringify({
      deployment_policy: {
        preferred_cloud: "azure",
        cost_preference: "high",
        latency_requirement: "high",
        sla_requirement: "99.95"
      }
    }),
    "utf8"
  )

  fs.writeFileSync(
    appPath,
    [
      "apiVersion: argoproj.io/v1alpha1",
      "kind: Application",
      "spec:",
      "  destination:",
      "    server: https://kubernetes.default.svc",
      "    namespace: aws",
      "  syncPolicy:",
      "    automated:",
      "      prune: true"
    ].join("\n"),
    "utf8"
  )

  try {
    const result = syncArgoFromPolicy({ policyPath, appPath })
    assert.equal(result.selected_cloud, "azure")
    assert.equal(result.namespace, "azure")
    assert.equal(result.updated, true)

    const updated = fs.readFileSync(appPath, "utf8")
    assert.match(updated, /namespace: azure/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
