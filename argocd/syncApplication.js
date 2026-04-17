const fs = require("fs")
const path = require("path")

function updateDestinationNamespace(manifest, namespace) {
  const destinationNamespacePattern = /(destination:\s*\n[\s\S]*?\n\s*namespace:\s*)([^\n]+)/

  if (!destinationNamespacePattern.test(manifest)) {
    throw new Error("Unable to find destination.namespace in Argo CD application manifest")
  }

  return manifest.replace(destinationNamespacePattern, `$1${namespace}`)
}

function syncArgoApplicationNamespace(namespace, options = {}) {
  const appPath = options.appPath || path.join(__dirname, "application.yaml")

  if (!fs.existsSync(appPath)) {
    return { updated: false, reason: "application manifest not found", appPath }
  }

  const current = fs.readFileSync(appPath, "utf8")
  const updated = updateDestinationNamespace(current, namespace)

  if (updated === current) {
    return { updated: false, reason: "namespace already set", appPath }
  }

  fs.writeFileSync(appPath, updated, "utf8")
  return { updated: true, namespace, appPath }
}

module.exports = {
  syncArgoApplicationNamespace,
  updateDestinationNamespace
}
