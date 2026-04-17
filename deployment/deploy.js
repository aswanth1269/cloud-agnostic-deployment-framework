const path = require("path")
const { execSync } = require("child_process")
const { evaluatePolicy } = require("../policy-engine/policyEngine")
const { syncArgoFromPolicy } = require("./syncArgoFromPolicy")


// Map cloud providers to Kubernetes namespaces

const NAMESPACE_MAP = {
  aws: "aws",
  azure: "azure",
  gcp: "gcp"
}

function runCommand(command) {
  console.log(command)
  try {
    const output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    const trimmedOutput = String(output || "").trim()
    if (trimmedOutput) {
      console.log(trimmedOutput)
    }
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : ""
    if (stderr) {
      console.error(stderr)
    }
    throw error
  }
}

function ensureClusterReady(executor, log) {
  log("Checking Kubernetes API server...")

  try {
    executor("kubectl cluster-info")
    log("Kubernetes API is reachable")
    return
  } catch (_error) {
    log("Kubernetes API unavailable. Starting Minikube...")
  }

  executor("minikube start")
  executor("kubectl config use-context minikube")
  executor("kubectl cluster-info")
  log("Minikube is running and Kubernetes API is reachable")
}

/**
 * Main deployment function orchestrating the entire workflow
 * 1. Evaluates deployment policy
 * 2. Selects cloud provider
 * 3. Builds Docker image
 * 4. Creates Kubernetes namespace
 * 5. Deploys application to selected namespace
 * @throws {Error} If policy evaluation or deployment fails
 */
function deploy(options = {}) {
  try {
    const repoRoot = path.join(__dirname, "..")
    const dockerfilePath = options.dockerfilePath || path.join(repoRoot, "docker", "Dockerfile")
    const dockerContextPath = options.dockerContextPath || repoRoot
    const policyPath = options.policyPath || path.join(__dirname, "..", "policy-engine", "policy.json")
    const manifestPath = options.manifestPath || path.join(__dirname, "..", "k8s", "deployment.yaml")
    const executor = options.executor || runCommand
    const logger = options.logger || console
    const shouldEnsureCluster = options.ensureCluster !== false && executor === runCommand
    const logs = []

    function log(message) {
      logs.push(message)
      logger.log(message)
    }

    log("Reading policy...")
    const { policy, selectedCloud } = evaluatePolicy(policyPath)
    const namespace = NAMESPACE_MAP[selectedCloud] || "azure"

    log(`Policy selected ${selectedCloud.toUpperCase()} deployment`)
    log(`Selected cloud: ${selectedCloud.toUpperCase()}`)
    log(`Deploying to namespace ${namespace}...`)

    if (executor === runCommand) {
      const argoResult = syncArgoFromPolicy({ policyPath })
      if (argoResult.updated) {
        log(`Argo CD application namespace set to ${argoResult.namespace}`)
      }
    }

    if (shouldEnsureCluster) {
      ensureClusterReady(executor, log)
    }

    log("Building Docker image...")
    executor(`docker build -t cloud-demo -f "${dockerfilePath}" "${dockerContextPath}"`)

    log("Loading image into Minikube...")
    executor(`minikube image load cloud-demo`)

    log(`Creating namespace ${namespace}...`)
    executor(
      `kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply --validate=false -f -`
    )

    log(`Applying Kubernetes manifest to namespace ${namespace}...`)
    executor(`kubectl apply -f ${manifestPath} -n ${namespace}`)

    log("Deployment successful")

    return {
      selected_cloud: selectedCloud,
      status: "deployment successful",
      namespace,
      policy,
      logs
    }
  } catch (error) {
    console.error(`Deployment failed: ${error.message}`)
    throw error
  }
}

// Execute deployment if this module is run directly
if (require.main === module) {
  deploy()
}

module.exports = {
  deploy
}