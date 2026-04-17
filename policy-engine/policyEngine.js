const fs = require("fs")
const path = require("path")
const { selectCloud } = require("./cloudSelector")

const isTestRun =
  process.env.NODE_ENV === "test" ||
  process.argv.includes("--test") ||
  process.env.npm_lifecycle_event === "test" ||
  process.env.npm_command === "test"

function logPolicyError(message) {
  if (!isTestRun) {
    console.error(message)
  }
}

/**
 * Reads the deployment policy from a JSON file
 * @param {string} policyPath - Path to the policy.json file
 * @returns {object} The deployment policy object
 */
function getDeploymentPolicy(policyPath = path.join(__dirname, "policy.json")) {
  try {
    const rawPolicy = fs.readFileSync(policyPath, "utf-8")
    const policy = JSON.parse(rawPolicy)
    return policy.deployment_policy || policy
  } catch (error) {
    logPolicyError(`Error reading policy file: ${error.message}`)
    throw new Error(`Failed to load policy from ${policyPath}`)
  }
}

/**
 * Evaluates the deployment policy and selects the appropriate cloud provider
 * @param {string} policyPath - Path to the policy.json file
 * @returns {object} Object containing policy and selectedCloud
 */
function evaluatePolicy(policyPath = path.join(__dirname, "policy.json")) {
  try {
    const policy = getDeploymentPolicy(policyPath)
    const selectedCloud = selectCloud(policy)

    return {
      policy,
      selectedCloud
    }
  } catch (error) {
    logPolicyError(`Policy evaluation failed: ${error.message}`)
    throw error
  }
}

module.exports = {
  getDeploymentPolicy,
  selectCloud,
  evaluatePolicy
}