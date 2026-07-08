const test = require("node:test")
const assert = require("node:assert/strict")
const { deploy } = require("../deployment/deploy")

function fakeExecutor(commands) {
  return (command, args) => {
    commands.push([command, ...args])
  }
}

test("local simulation runs build, load, namespace, apply with arg arrays", async () => {
  const commands = []

  const result = await deploy({
    policy: { preferred_cloud: "gcp", cost_preference: "low", latency_requirement: "high" },
    executor: fakeExecutor(commands),
    contexts: {},
    imageRegistry: "",
    dryRun: false,
    quiet: true
  })

  assert.equal(result.selected_cloud, "aws")
  assert.equal(result.namespace, "aws")
  assert.equal(result.mode, "local-simulation")
  assert.equal(result.status, "deployment successful")
  assert.equal(result.image, "cloud-demo:local")

  const names = commands.map((c) => c.slice(0, 2).join(" "))
  assert.ok(names.includes("docker build"))
  assert.ok(names.includes("minikube image"))
  assert.ok(names.some((n) => n.startsWith("kubectl create")))
  assert.ok(names.some((n) => n.startsWith("kubectl apply")))

  const apply = commands.find((c) => c[0] === "kubectl" && c[1] === "apply")
  assert.deepEqual(apply.slice(-2), ["-n", "aws"])
})

test("kube context targets the real cluster with the kustomize overlay", async () => {
  const commands = []

  const result = await deploy({
    policy: { preferred_cloud: "azure" },
    executor: fakeExecutor(commands),
    contexts: { azure: "my-aks-context" },
    imageRegistry: "ghcr.io/aswanth1269",
    imageTag: "abc123",
    dryRun: false,
    quiet: true
  })

  assert.equal(result.selected_cloud, "azure")
  assert.equal(result.mode, "context")
  assert.equal(result.image, "ghcr.io/aswanth1269/cloud-demo:abc123")

  const push = commands.find((c) => c[0] === "docker" && c[1] === "push")
  assert.deepEqual(push, ["docker", "push", "ghcr.io/aswanth1269/cloud-demo:abc123"])

  const apply = commands.find((c) => c[0] === "kubectl" && c.includes("apply"))
  assert.equal(apply[1], "--context")
  assert.equal(apply[2], "my-aks-context")
  assert.ok(apply.includes("-k"))

  assert.ok(!commands.some((c) => c[0] === "minikube"))
})

test("dry run executes nothing but logs every command", async () => {
  const commands = []

  const result = await deploy({
    policy: { latency_requirement: "low", sla_requirement: "99.90" },
    executor: fakeExecutor(commands),
    contexts: {},
    imageRegistry: "",
    dryRun: true,
    quiet: true
  })

  assert.equal(result.selected_cloud, "gcp")
  assert.equal(result.status, "dry run successful")
  assert.equal(result.dry_run, true)
  assert.equal(commands.length, 0)
  assert.ok(result.logs.some((line) => line.includes("[dry-run] $ docker build")))
  assert.ok(result.logs.some((line) => line.includes("[dry-run] $ kubectl apply")))
})

test("namespace AlreadyExists errors are tolerated", async () => {
  const result = await deploy({
    policy: { preferred_cloud: "gcp" },
    executor: (command, args) => {
      if (command === "kubectl" && args[0] === "create") {
        const error = new Error('namespaces "gcp" AlreadyExists')
        throw error
      }
    },
    contexts: {},
    imageRegistry: "",
    dryRun: false,
    quiet: true
  })

  assert.equal(result.status, "deployment successful")
})

test("command failures propagate", async () => {
  await assert.rejects(
    deploy({
      policy: { preferred_cloud: "aws" },
      executor: () => {
        throw new Error("docker daemon not running")
      },
      contexts: {},
      imageRegistry: "",
      dryRun: false,
      quiet: true
    }),
    /docker daemon not running/
  )
})
