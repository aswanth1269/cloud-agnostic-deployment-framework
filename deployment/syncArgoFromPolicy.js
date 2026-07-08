const path = require("path")
const { evaluate } = require("../policy-engine/cloudSelector")
const { getDeploymentPolicy } = require("../policy-engine/policyEngine")
const { syncArgoApplication } = require("../argocd/syncApplication")

/**
 * Updates argocd/application.yaml so Argo CD tracks the overlay and
 * namespace chosen by the deployment policy.
 * @param {object} [options] - { policy, policyPath, appPath }
 */
function syncArgoFromPolicy(options = {}) {
  const policy = options.policy || getDeploymentPolicy(options.policyPath)
  const evaluation = evaluate(policy)
  const selectedCloud = evaluation.selected
  const namespace = selectedCloud
  const overlayPath = path.posix.join("k8s", "overlays", selectedCloud)

  const result = syncArgoApplication(namespace, {
    appPath: options.appPath,
    overlayPath
  })

  return {
    selected_cloud: selectedCloud,
    namespace,
    overlayPath,
    ...result
  }
}

if (require.main === module) {
  const result = syncArgoFromPolicy()
  if (result.updated) {
    console.log(`Argo CD application updated: namespace=${result.namespace}, path=${result.overlayPath}`)
  } else {
    console.log(`Argo CD application sync skipped: ${result.reason}`)
  }
}

module.exports = { syncArgoFromPolicy }
