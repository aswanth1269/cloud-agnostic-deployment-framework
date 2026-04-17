const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { getDeploymentPolicy, evaluatePolicy } = require("../policy-engine/policyEngine")

function withTempFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "policy-engine-test-"))
  const filePath = path.join(dir, "policy.json")
  fs.writeFileSync(filePath, content, "utf8")
  return { dir, filePath }
}

test("getDeploymentPolicy reads nested deployment_policy", () => {
  const { dir, filePath } = withTempFile(
    JSON.stringify({ deployment_policy: { preferred_cloud: "gcp", cost_preference: "low", sla_requirement: "99.95" } })
  )

  try {
    const policy = getDeploymentPolicy(filePath)
    assert.deepEqual(policy, { preferred_cloud: "gcp", cost_preference: "low", sla_requirement: "99.95" })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("getDeploymentPolicy reads flat policy format", () => {
  const { dir, filePath } = withTempFile(JSON.stringify({ preferred_cloud: "azure" }))

  try {
    const policy = getDeploymentPolicy(filePath)
    assert.deepEqual(policy, { preferred_cloud: "azure" })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("getDeploymentPolicy throws on missing file", () => {
  assert.throws(
    () => getDeploymentPolicy(path.join(os.tmpdir(), "does-not-exist-policy.json")),
    /Failed to load policy/
  )
})

test("getDeploymentPolicy throws on invalid JSON", () => {
  const { dir, filePath } = withTempFile("{ invalid json")

  try {
    assert.throws(() => getDeploymentPolicy(filePath), /Failed to load policy/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("evaluatePolicy returns both policy and selected cloud", () => {
  const { dir, filePath } = withTempFile(
    JSON.stringify({ deployment_policy: { preferred_cloud: "invalid", cost_preference: "low" } })
  )

  try {
    const result = evaluatePolicy(filePath)
    assert.deepEqual(result.policy, { preferred_cloud: "invalid", cost_preference: "low" })
    assert.equal(result.selectedCloud, "aws")
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
