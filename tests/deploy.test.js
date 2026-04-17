const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { deploy } = require("../deployment/deploy")

function withTempPolicy(policy) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-engine-test-"))
  const filePath = path.join(dir, "policy.json")
  fs.writeFileSync(filePath, JSON.stringify({ deployment_policy: policy }), "utf8")
  return { dir, filePath }
}

test("deploy runs cloud-specific commands for low cost", () => {
  const { dir, filePath } = withTempPolicy({
    preferred_cloud: "gcp",
    cost_preference: "low",
    latency_requirement: "high"
  })
  const commands = []
  const logs = []

  try {
    const result = deploy({
      policyPath: filePath,
      manifestPath: path.join("k8s", "deployment.yaml"),
      executor: (command) => {
        commands.push(command)
      },
      logger: {
        log: (message) => logs.push(message)
      }
    })

    assert.deepEqual(result, {
      selected_cloud: "aws",
      status: "deployment successful",
      namespace: "aws",
      policy: {
        preferred_cloud: "gcp",
        cost_preference: "low",
        latency_requirement: "high"
      },
      logs: [
        "Reading policy...",
        "Policy selected AWS deployment",
        "Selected cloud: AWS",
        "Deploying to namespace aws...",
        "Building Docker image...",
        "Loading image into Minikube...",
        "Creating namespace aws...",
        "Applying Kubernetes manifest to namespace aws...",
        "Deployment successful"
      ]
    })
    assert.deepEqual(commands, [
      `docker build -t cloud-demo -f \"${path.join(__dirname, "..", "docker", "Dockerfile")}\" \"${path.join(__dirname, "..") }\"`,
      "minikube image load cloud-demo",
      "kubectl create namespace aws --dry-run=client -o yaml | kubectl apply --validate=false -f -",
      `kubectl apply -f ${path.join("k8s", "deployment.yaml")} -n aws`
    ])
    assert.deepEqual(logs, [
      "Reading policy...",
      "Policy selected AWS deployment",
      "Selected cloud: AWS",
      "Deploying to namespace aws...",
      "Building Docker image...",
      "Loading image into Minikube...",
      "Creating namespace aws...",
      "Applying Kubernetes manifest to namespace aws...",
      "Deployment successful"
    ])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
