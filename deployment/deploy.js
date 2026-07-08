const path = require("path")
const { evaluate } = require("../policy-engine/cloudSelector")
const { getDeploymentPolicy } = require("../policy-engine/policyEngine")
const { loadCatalog } = require("../policy-engine/cloudSelector")
const commandRunner = require("./commandRunner")
const { syncArgoFromPolicy } = require("./syncArgoFromPolicy")

const REPO_ROOT = path.join(__dirname, "..")

function envBool(value) {
  return String(value || "").toLowerCase() === "true"
}

/**
 * Policy-driven deployment orchestrator.
 *
 * Modes (decided per selected cloud):
 * - "context":          a kubectl context is configured for the selected cloud
 *                       (KUBE_CONTEXT_AWS / _AZURE / _GCP) -> deploys the
 *                       kustomize overlay to that REAL cluster.
 * - "local-simulation": no context configured -> builds locally, loads the
 *                       image into Minikube and deploys into a namespace
 *                       named after the cloud (demo behavior).
 *
 * Dry-run: logs every command it WOULD run, executes nothing. Safe anywhere.
 *
 * @param {object} options
 * @param {object} [options.policy]      - policy object (preferred; avoids disk writes)
 * @param {string} [options.policyPath]  - fallback: read policy from file
 * @param {boolean} [options.dryRun]     - simulate only (default: env DEPLOY_DRY_RUN)
 * @param {function} [options.onLog]     - receives every log line (for streaming)
 * @param {function} [options.executor]  - async (command, argsArray) => void (test hook)
 * @param {object} [options.contexts]    - override kube contexts: { aws, azure, gcp }
 * @param {string} [options.imageRegistry] - e.g. ghcr.io/aswanth1269
 * @param {string} [options.imageTag]
 * @returns {Promise<object>} deployment result with logs and policy evaluation
 */
async function deploy(options = {}) {
  const logs = []
  const onLog = options.onLog || (() => {})

  function log(message) {
    logs.push(message)
    onLog(message)
    if (options.quiet !== true) console.log(message)
  }

  const dryRun = options.dryRun !== undefined ? Boolean(options.dryRun) : envBool(process.env.DEPLOY_DRY_RUN)
  const usingDefaultExecutor = !options.executor
  const executor = options.executor
    ? async (command, args) => options.executor(command, args)
    : async (command, args) => {
        await commandRunner.run(command, args, { cwd: REPO_ROOT, onLine: (line) => log(`  ${line}`) })
      }

  async function step(description, command, args, { allowFailurePattern } = {}) {
    const printable = `${command} ${args.join(" ")}`
    if (dryRun) {
      log(`[dry-run] $ ${printable}`)
      return
    }
    log(`$ ${printable}`)
    try {
      await executor(command, args)
    } catch (error) {
      const details = `${error.message} ${error.stderr || ""}`
      if (allowFailurePattern && allowFailurePattern.test(details)) {
        log(`  (ignored: ${allowFailurePattern})`)
        return
      }
      throw error
    }
  }

  // 1. Resolve and evaluate the policy
  log("Reading policy...")
  const policy = options.policy || getDeploymentPolicy(options.policyPath)
  const evaluation = evaluate(policy)
  const selectedCloud = evaluation.selected

  const catalog = loadCatalog()
  const provider = catalog.providers[selectedCloud]
  const namespace = provider.namespace

  log(`Policy selected ${selectedCloud.toUpperCase()} deployment`)
  for (const line of evaluation.explanation) {
    log(`  ${line}`)
  }

  // 2. Decide target mode
  const contexts = options.contexts || {
    aws: process.env.KUBE_CONTEXT_AWS,
    azure: process.env.KUBE_CONTEXT_AZURE,
    gcp: process.env.KUBE_CONTEXT_GCP
  }
  const kubeContext = contexts[selectedCloud]
  const mode = kubeContext ? "context" : "local-simulation"

  const imageRegistry = options.imageRegistry !== undefined ? options.imageRegistry : process.env.IMAGE_REGISTRY
  const imageTag = options.imageTag || process.env.IMAGE_TAG || "latest"
  const image = imageRegistry ? `${imageRegistry}/cloud-demo:${imageTag}` : "cloud-demo:local"

  if (mode === "context") {
    log(`Target: REAL cluster via kubectl context "${kubeContext}"`)
  } else {
    log(`Target: local Minikube simulation (namespace "${namespace}")`)
    log(`  Tip: set ${provider.kube_context_env} to deploy to a real ${selectedCloud.toUpperCase()} cluster`)
  }

  // 3. Keep the Argo CD application manifest in sync with the policy outcome
  if (usingDefaultExecutor && !dryRun && options.syncArgo !== false) {
    try {
      const argoResult = syncArgoFromPolicy({ policy })
      if (argoResult.updated) {
        log(`Argo CD application synced: namespace=${argoResult.namespace}, path=${argoResult.overlayPath}`)
      }
    } catch (error) {
      log(`  (warning: Argo CD sync skipped - ${error.message})`)
    }
  }

  // 4. Make sure a cluster is reachable (local simulation only)
  if (mode === "local-simulation" && !dryRun && usingDefaultExecutor && options.ensureCluster !== false) {
    log("Checking Kubernetes API server...")
    try {
      await executor("kubectl", ["cluster-info"])
      log("Kubernetes API is reachable")
    } catch (_error) {
      log("Kubernetes API unavailable. Starting Minikube...")
      await step("Start Minikube", "minikube", ["start"])
      await step("Use minikube context", "kubectl", ["config", "use-context", "minikube"])
      await step("Verify cluster", "kubectl", ["cluster-info"])
    }
  }

  // 5. Build the image
  log("Building Docker image...")
  await step("Build image", "docker", [
    "build",
    "-t", image,
    "-f", options.dockerfilePath || path.join(REPO_ROOT, "docker", "Dockerfile"),
    options.dockerContextPath || REPO_ROOT
  ])

  // 6. Publish / load the image
  if (imageRegistry) {
    log(`Pushing image to ${imageRegistry}...`)
    await step("Push image", "docker", ["push", image])
  } else if (mode === "local-simulation") {
    log("Loading image into Minikube...")
    await step("Load image", "minikube", ["image", "load", image])
  }

  // 7. Deploy
  if (mode === "context") {
    const overlay = options.overlayPath || path.join(REPO_ROOT, "k8s", "overlays", selectedCloud)
    log(`Applying kustomize overlay for ${selectedCloud.toUpperCase()}...`)
    await step("Create namespace", "kubectl", ["--context", kubeContext, "create", "namespace", namespace], {
      allowFailurePattern: /AlreadyExists/i
    })
    await step("Apply overlay", "kubectl", ["--context", kubeContext, "apply", "-k", overlay])
  } else {
    const manifest = options.manifestPath || path.join(REPO_ROOT, "k8s", "local", "deployment.yaml")
    log(`Creating namespace ${namespace}...`)
    await step("Create namespace", "kubectl", ["create", "namespace", namespace], {
      allowFailurePattern: /AlreadyExists/i
    })
    log(`Applying Kubernetes manifest to namespace ${namespace}...`)
    await step("Apply manifest", "kubectl", ["apply", "-f", manifest, "-n", namespace])
  }

  log(dryRun ? "Dry run complete - no commands were executed" : "Deployment successful")

  return {
    selected_cloud: selectedCloud,
    status: dryRun ? "dry run successful" : "deployment successful",
    namespace,
    mode,
    image,
    dry_run: dryRun,
    policy,
    evaluation,
    logs
  }
}

// CLI entrypoint: node deployment/deploy.js [--dry-run]
if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run")
  deploy({ dryRun })
    .then((result) => {
      console.log(`Done: ${result.status} (${result.selected_cloud}, mode=${result.mode})`)
    })
    .catch((error) => {
      console.error(`Deployment failed: ${error.message}`)
      process.exit(1)
    })
}

module.exports = { deploy }
