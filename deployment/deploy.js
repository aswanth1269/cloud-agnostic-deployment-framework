const path = require("path")
const { execSync } = require("child_process")
const { evaluatePolicy } = require("../policy-engine/policyEngine")

// Map cloud providers to Kubernetes namespaces
const NAMESPACE_MAP = {
  aws: "aws",
  azure: "azure",
  gcp: "gcp"
}

/**
 * Executes a shell command with output logging
 * @param {string} command - The command to execute
 * @throws {Error} If the command fails
 */
function runCommand(command) {
  console.log(`\n📦 Running command: ${command}`)
  try {
    execSync(command, { stdio: "inherit" })
  } catch (error) {
    console.error(`❌ Command failed: ${command}`)
    throw error
  }
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
function deploy() {
  try {
    // Construct paths to policy and K8s manifest
    const policyPath = path.join(__dirname, "..", "policy-engine", "policy.json")
    const manifestPath = path.join(__dirname, "..", "k8s", "deployment.yaml")

    // Evaluate policy and select cloud provider
    const { policy, selectedCloud } = evaluatePolicy(policyPath)

    // Map cloud provider to Kubernetes namespace
    const namespace = NAMESPACE_MAP[selectedCloud] || "default"

    // Log deployment decision
    console.log(`\n🚀 Policy selected ${selectedCloud.toUpperCase()} deployment`)
    console.log(`📍 Deploying to namespace: ${namespace}`)
    console.log(`Policy details:`, policy)

    // Build Docker image
    console.log(`\n🐳 Building Docker image...`)
    runCommand(`docker build -t cloud-demo -f docker/Dockerfile .`)

    // Create namespace if it doesn't exist
    console.log(`\n☸️  Creating Kubernetes namespace...`)
    runCommand(
      `kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`
    )

    // Deploy application to Kubernetes
    console.log(`\n🎯 Deploying to Kubernetes...`)
    runCommand(`kubectl apply -f ${manifestPath} -n ${namespace}`)

    console.log(`\n✅ Deployment complete! Application running in ${namespace} namespace`)
  } catch (error) {
    console.error(`\n❌ Deployment failed: ${error.message}`)
    process.exit(1)
  }
}

// Execute deployment if this module is run directly
if (require.main === module) {
  deploy()
}

module.exports = {
  deploy
}