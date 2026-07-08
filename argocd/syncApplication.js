const fs = require("fs")
const path = require("path")

/**
 * Rewrites destination.namespace in an Argo CD Application manifest.
 */
function updateDestinationNamespace(manifest, namespace) {
  const pattern = /(destination:\s*\n[\s\S]*?\n\s*namespace:\s*)([^\n]+)/

  if (!pattern.test(manifest)) {
    throw new Error("Unable to find destination.namespace in Argo CD application manifest")
  }

  return manifest.replace(pattern, `$1${namespace}`)
}

/**
 * Rewrites source.path in an Argo CD Application manifest so the
 * application tracks the kustomize overlay for the selected cloud.
 */
function updateSourcePath(manifest, overlayPath) {
  const pattern = /(source:\s*\n[\s\S]*?\n\s*path:\s*)([^\n]+)/

  if (!pattern.test(manifest)) {
    throw new Error("Unable to find source.path in Argo CD application manifest")
  }

  return manifest.replace(pattern, `$1${overlayPath}`)
}

/**
 * Syncs the Argo CD Application manifest with a policy outcome.
 * @param {string} namespace - destination namespace (aws | azure | gcp)
 * @param {object} [options] - { appPath, overlayPath }
 */
function syncArgoApplication(namespace, options = {}) {
  const appPath = options.appPath || path.join(__dirname, "application.yaml")
  const overlayPath = options.overlayPath

  if (!fs.existsSync(appPath)) {
    return { updated: false, reason: "application manifest not found", appPath }
  }

  const current = fs.readFileSync(appPath, "utf8")
  let updated = updateDestinationNamespace(current, namespace)
  if (overlayPath) {
    updated = updateSourcePath(updated, overlayPath)
  }

  if (updated === current) {
    return { updated: false, reason: "manifest already in sync", appPath }
  }

  fs.writeFileSync(appPath, updated, "utf8")
  return { updated: true, namespace, overlayPath, appPath }
}

module.exports = {
  syncArgoApplication,
  // kept for backwards compatibility
  syncArgoApplicationNamespace: syncArgoApplication,
  updateDestinationNamespace,
  updateSourcePath
}
