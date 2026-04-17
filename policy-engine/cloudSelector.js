const VALID_CLOUDS = new Set(["aws", "azure", "gcp"])
const CLOUD_SLA = {
  gcp: 99.9,
  azure: 99.95,
  aws: 99.99
}

/**
 * Selects the optimal cloud provider based on deployment policy
 * 
 * Priority hierarchy:
 * 1. cost_preference - low cost maps to aws
 * 2. latency_requirement - low latency maps to gcp
 * 3. sla_requirement - minimum SLA maps to the closest matching provider
 * 4. preferred_cloud - explicit cloud preference
 * 5. default: "azure" - if no conditions match
 * 
 * @param {Object} policy - Deployment policy object
 * @param {string} [policy.preferred_cloud] - Preferred cloud (aws|azure|gcp)
 * @param {string} [policy.cost_preference] - Cost priority (low|medium|high)
 * @param {string} [policy.latency_requirement] - Latency priority (low|medium|high)
 * @param {string|number} [policy.sla_requirement] - Minimum SLA target (for example: 99.95)
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
  if (!policy || typeof policy !== "object") {
    throw new Error("Policy must be a valid object")
  }

  const costPreference = String(policy.cost_preference || "").toLowerCase()
  if (costPreference === "low") {
    return "aws"
  }

  const latencyRequirement = String(policy.latency_requirement || "").toLowerCase()
  if (latencyRequirement === "low") {
    return "gcp"
  }

  const parsedSlaRequirement = Number(policy.sla_requirement)
  if (Number.isFinite(parsedSlaRequirement)) {
    const matchedCloud = Object.entries(CLOUD_SLA)
      .sort((first, second) => first[1] - second[1])
      .find(([, cloudSla]) => cloudSla >= parsedSlaRequirement)

    if (matchedCloud) {
      return matchedCloud[0]
    }
  }

  const preferredCloud = String(policy.preferred_cloud || "").toLowerCase()
  if (VALID_CLOUDS.has(preferredCloud)) {
    return preferredCloud
  }

  return "azure"
}

module.exports = {
  selectCloud
}