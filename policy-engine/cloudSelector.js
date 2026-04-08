/**
 * Cloud Selector Module
 * 
 * Implements a deterministic priority-based algorithm to select the appropriate
 * cloud provider based on deployment policies. Ensures consistent, repeatable
 * cloud selection decisions across different deployments.
 */

// Valid cloud provider options
const VALID_CLOUDS = new Set(["aws", "azure", "gcp"])

/**
 * Cost-based cloud provider mappings
 * Maps cost preferences to cloud providers
 */
const COST_TO_CLOUD = {
  low: "gcp",        // GCP offers competitive pricing
  medium: "azure",   // Azure balanced pricing
  high: "aws"        // AWS premium features
}

/**
 * Latency-based cloud provider mappings
 * Maps latency requirements to cloud providers
 */
const LATENCY_TO_CLOUD = {
  low: "aws",        // AWS primary regions offer lowest latency
  medium: "azure",   // Azure supports balanced latency profiles
  high: "gcp"        // GCP can scale high-latency workloads
}

/**
 * Selects the optimal cloud provider based on deployment policy
 * 
 * Priority hierarchy:
 * 1. preferred_cloud - explicit cloud preference (highest priority)
 * 2. cost_preference - cost optimization (fallback)
 * 3. latency_requirement - performance optimization (fallback)
 * 4. default: "aws" - if no conditions match
 * 
 * @param {Object} policy - Deployment policy object
 * @param {string} [policy.preferred_cloud] - Preferred cloud (aws|azure|gcp)
 * @param {string} [policy.cost_preference] - Cost priority (low|medium|high)
 * @param {string} [policy.latency_requirement] - Latency priority (low|medium|high)
 * @returns {string} Selected cloud provider (aws|azure|gcp)
 * @throws {Error} If policy is not a valid object
 * 
 * @example
 * // Explicit cloud preference takes priority
 * selectCloud({ preferred_cloud: "azure" }) // returns "azure"
 * 
 * @example
 * // Cost-based fallback
 * selectCloud({ cost_preference: "low" }) // returns "gcp"
 * 
 * @example
 * // Latency-based fallback
 * selectCloud({ latency_requirement: "low" }) // returns "aws"
 */
function selectCloud(policy) {
  // Validate policy input
  if (!policy || typeof policy !== "object") {
    throw new Error("Policy must be a valid object")
  }

  // Priority 1: Highest-priority rule - explicit cloud preference
  const preferredCloud = String(policy.preferred_cloud || "").toLowerCase()
  if (VALID_CLOUDS.has(preferredCloud)) {
    return preferredCloud
  }

  // Priority 2: Second priority - cost-based fallback mapping
  const costPreference = String(policy.cost_preference || "").toLowerCase()
  if (COST_TO_CLOUD[costPreference]) {
    return COST_TO_CLOUD[costPreference]
  }

  // Priority 3: Third priority - latency-based fallback mapping
  const latencyRequirement = String(policy.latency_requirement || "").toLowerCase()
  if (LATENCY_TO_CLOUD[latencyRequirement]) {
    return LATENCY_TO_CLOUD[latencyRequirement]
  }

  // Default fallback if no conditions match
  return "aws"
}

module.exports = {
  selectCloud
}