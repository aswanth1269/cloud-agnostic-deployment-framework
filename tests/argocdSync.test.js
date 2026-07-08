const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { syncArgoApplication } = require("../argocd/syncApplication")
const { syncArgoFromPolicy } = require("../deployment/syncArgoFromPolicy")

const SAMPLE_MANIFEST = [
  "apiVersion: argoproj.io/v1alpha1",
  "kind: Application",
  "spec:",
  "  source:",
  "    repoURL: https://github.com/aswanth1269/cloud-agnostic-deployment-framework.git",
  "    targetRevision: main",
  "    path: k8s/overlays/aws",
  "  destination:",
  "    server: https://kubernetes.default.svc",
  "    namespace: aws",
  "  syncPolicy:",
  "    automated:",
  "      prune: true"
].join("\n")

function withTempManifest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "argocd-sync-test-"))
  const appPath = path.join(dir, "application.yaml")
  fs.writeFileSync(appPath, SAMPLE_MANIFEST, "utf8")
  return { dir, appPath }
}

test("syncArgoApplication updates namespace and overlay path", () => {
  const { dir, appPath } = withTempManifest()
  try {
    const result = syncArgoApplication("gcp", { appPath, overlayPath: "k8s/overlays/gcp" })
    assert.equal(result.updated, true)

    const updated = fs.readFileSync(appPath, "utf8")
    assert.match(updated, /namespace: gcp/)
    assert.match(updated, /path: k8s\/overlays\/gcp/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("syncArgoApplication reports no-op when already in sync", () => {
  const { dir, appPath } = withTempManifest()
  try {
    const result = syncArgoApplication("aws", { appPath, overlayPath: "k8s/overlays/aws" })
    assert.equal(result.updated, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("syncArgoFromPolicy maps the policy outcome onto the manifest", () => {
  const { dir, appPath } = withTempManifest()
  try {
    const result = syncArgoFromPolicy({
      policy: { preferred_cloud: "azure", cost_preference: "high", latency_requirement: "high", sla_requirement: "99.95" },
      appPath
    })

    assert.equal(result.selected_cloud, "azure")
    assert.equal(result.namespace, "azure")
    assert.equal(result.overlayPath, "k8s/overlays/azure")
    assert.equal(result.updated, true)

    const updated = fs.readFileSync(appPath, "utf8")
    assert.match(updated, /namespace: azure/)
    assert.match(updated, /path: k8s\/overlays\/azure/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("syncArgoFromPolicy handles a missing manifest gracefully", () => {
  const result = syncArgoFromPolicy({
    policy: { preferred_cloud: "gcp" },
    appPath: path.join(os.tmpdir(), "missing-application.yaml")
  })
  assert.equal(result.updated, false)
  assert.match(result.reason, /not found/)
})
