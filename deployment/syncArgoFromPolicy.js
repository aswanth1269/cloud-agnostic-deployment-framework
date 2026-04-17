const path = require("path")
const { evaluatePolicy } = require("../policy-engine/policyEngine")
const { syncArgoApplicationNamespace } = require("../argocd/syncApplication")

const NAMESPACE_MAP = {
  aws: "aws",
  azure: "azure",
  gcp: "gcp"
}

function syncArgoFromPolicy(options = {}) {
  const policyPath = options.policyPath || path.join(__dirname, "..", "policy-engine", "policy.json")
  const appPath = options.appPath || path.join(__dirname, "..", "argocd", "application.yaml")

  const { selectedCloud } = evaluatePolicy(policyPath)
  const namespace = NAMESPACE_MAP[selectedCloud] || "azure"
  const result = syncArgoApplicationNamespace(namespace, { appPath })

  return {
    selected_cloud: selectedCloud,
    namespace,
    ...result
  }
}

if (require.main === module) {
  const result = syncArgoFromPolicy()
  if (result.updated) {
    console.log(`Argo CD application namespace updated to ${result.namespace}`)
  } else {
    console.log(`Argo CD application sync skipped: ${result.reason}`)
  }
}

module.exports = {
  syncArgoFromPolicy
}
