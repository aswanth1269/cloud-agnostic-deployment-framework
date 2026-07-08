const fs = require("fs")
const path = require("path")
const { evaluate, selectCloud } = require("./cloudSelector")

const DEFAULT_POLICY_PATH = path.join(__dirname, "policy.json")

/**
 * Reads the deployment policy from a JSON file.
 * Supports both { deployment_policy: {...} } and flat {...} formats.
 * @param {string} policyPath - path to policy.json
 * @returns {object} the deployment policy object
 */
function getDeploymentPolicy(policyPath = DEFAULT_POLICY_PATH) {
  try {
    const rawPolicy = fs.readFileSync(policyPath, "utf-8")
    const policy = JSON.parse(rawPolicy)
    return policy.deployment_policy || policy
  } catch (error) {
    throw new Error(`Failed to load policy from ${policyPath}: ${error.message}`)
  }
}

/**
 * Evaluates the deployment policy file and selects a cloud provider.
 * @param {string} policyPath - path to policy.json
 * @returns {{policy: object, selectedCloud: string, evaluation: object}}
 */
function evaluatePolicy(policyPath = DEFAULT_POLICY_PATH) {
  const policy = getDeploymentPolicy(policyPath)
  const evaluation = evaluate(policy)

  return {
    policy,
    selectedCloud: evaluation.selected,
    evaluation
  }
}

module.exports = {
  getDeploymentPolicy,
  evaluatePolicy,
  evaluate,
  selectCloud
}
