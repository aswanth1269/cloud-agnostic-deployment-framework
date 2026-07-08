const fs = require("fs")
const path = require("path")

const PROVIDERS_PATH = path.join(__dirname, "providers.json")
const VALID_PREFERENCES = new Set(["", "low", "medium", "high"])

let cachedCatalog = null

/**
 * Loads the provider catalog (cost/latency/SLA data + scoring weights).
 * The default catalog is cached after the first read.
 */
function loadCatalog(catalogPath) {
  if (!catalogPath) {
    if (!cachedCatalog) {
      cachedCatalog = JSON.parse(fs.readFileSync(PROVIDERS_PATH, "utf8"))
    }
    return cachedCatalog
  }
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"))
}

/**
 * Evaluates a deployment policy against the provider catalog using
 * weighted scoring instead of hardcoded if/else rules.
 *
 * Steps:
 * 1. Hard filter: providers must meet sla_requirement (if provided).
 * 2. Score: cost weight x cost points + latency weight x latency points
 *    + preferred-cloud bonus + closest-SLA-match bonus.
 * 3. Pick the highest score. If nothing scores above zero, fall back to
 *    the catalog default provider.
 *
 * @param {object} policy - deployment policy
 * @param {object} [options] - { catalog, catalogPath } overrides for testing
 * @returns {{selected: string, eligible: string[], scores: Array, explanation: string[]}}
 * @throws {Error} if policy is not a valid object
 */
function evaluate(policy, options = {}) {
  if (!policy || typeof policy !== "object") {
    throw new Error("Policy must be a valid object")
  }

  const catalog = options.catalog || loadCatalog(options.catalogPath)
  const providers = catalog.providers
  const weights = catalog.weights
  const names = Object.keys(providers)
  const explanation = []

  const costPreference = String(policy.cost_preference || "").toLowerCase()
  const latencyRequirement = String(policy.latency_requirement || "").toLowerCase()
  const preferredCloud = String(policy.preferred_cloud || "").toLowerCase()
  const slaRequirement = Number(policy.sla_requirement)
  const hasSla = Number.isFinite(slaRequirement)

  const costWeight = VALID_PREFERENCES.has(costPreference) ? (weights.cost[costPreference] || 0) : 0
  const latencyWeight = VALID_PREFERENCES.has(latencyRequirement)
    ? (weights.latency[latencyRequirement] || 0)
    : 0

  if (preferredCloud && !providers[preferredCloud]) {
    explanation.push(`Ignoring unknown preferred_cloud "${preferredCloud}"`)
  }

  // 1. Hard SLA filter
  let eligible = names
  if (hasSla) {
    eligible = names.filter((name) => providers[name].sla >= slaRequirement)
    if (eligible.length === 0) {
      explanation.push(
        `No provider meets SLA ${slaRequirement}% - considering all providers instead`
      )
      eligible = names
    } else {
      explanation.push(
        `SLA filter ${slaRequirement}%: eligible providers are ${eligible.join(", ")}`
      )
    }
  }

  // Closest SLA match (smallest margin above the requirement)
  let closestProvider = null
  if (hasSla) {
    closestProvider = eligible.reduce((best, name) => {
      const margin = providers[name].sla - slaRequirement
      if (margin < 0) return best
      if (!best || margin < providers[best].sla - slaRequirement) return name
      return best
    }, null)
  }

  // 2. Score every eligible provider
  const maxIndex = names.length + 1
  const scores = eligible.map((name) => {
    const provider = providers[name]
    const reasons = []
    let score = 0

    if (costWeight > 0) {
      const points = costWeight * (maxIndex - provider.cost_index)
      score += points
      reasons.push(`cost rank #${provider.cost_index} with "${costPreference}" cost preference: +${points}`)
    }

    if (latencyWeight > 0) {
      const points = latencyWeight * (maxIndex - provider.latency_index)
      score += points
      reasons.push(
        `latency rank #${provider.latency_index} with "${latencyRequirement}" latency requirement: +${points}`
      )
    }

    if (preferredCloud === name) {
      score += weights.preferred_bonus
      reasons.push(`preferred cloud match: +${weights.preferred_bonus}`)
    }

    if (closestProvider === name) {
      score += weights.sla_closeness_bonus
      reasons.push(
        `closest SLA match (${provider.sla}% >= ${slaRequirement}%): +${weights.sla_closeness_bonus}`
      )
    }

    return { provider: name, display_name: provider.display_name, sla: provider.sla, score, reasons }
  })

  // 3. Deterministic ordering: score desc, then SLA margin asc, then name asc
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (hasSla) {
      const marginA = providers[a.provider].sla - slaRequirement
      const marginB = providers[b.provider].sla - slaRequirement
      if (marginA !== marginB) return marginA - marginB
    }
    return a.provider.localeCompare(b.provider)
  })

  let selected
  if (scores[0].score > 0) {
    selected = scores[0].provider
    explanation.push(`Selected ${selected} with the highest score (${scores[0].score})`)
  } else {
    const fallback = catalog.default_provider
    selected = eligible.includes(fallback) ? fallback : scores[0].provider
    explanation.push(`No scoring rule matched - falling back to default provider "${selected}"`)
  }

  return { selected, eligible, scores, explanation }
}

/**
 * Backwards-compatible helper: returns only the selected provider id.
 * @param {object} policy
 * @returns {string} aws | azure | gcp
 */
function selectCloud(policy, options = {}) {
  return evaluate(policy, options).selected
}

module.exports = {
  evaluate,
  selectCloud,
  loadCatalog
}
