const test = require("node:test")
const assert = require("node:assert/strict")
const { selectCloud, evaluate } = require("../policy-engine/cloudSelector")

test("low cost preference selects the cheapest provider (aws)", () => {
  assert.equal(selectCloud({ cost_preference: "low" }), "aws")
  assert.equal(selectCloud({ preferred_cloud: "azure", cost_preference: "low" }), "aws")
})

test("low latency requirement selects the fastest provider (gcp)", () => {
  assert.equal(selectCloud({ latency_requirement: "low" }), "gcp")
  assert.equal(selectCloud({ preferred_cloud: "invalid", latency_requirement: "low" }), "gcp")
})

test("cost outweighs latency when both are low", () => {
  assert.equal(selectCloud({ cost_preference: "low", latency_requirement: "low" }), "aws")
})

test("sla_requirement filters and picks the closest match", () => {
  assert.equal(selectCloud({ sla_requirement: "99.00" }), "gcp")
  assert.equal(selectCloud({ sla_requirement: "99.50" }), "gcp")
  assert.equal(selectCloud({ sla_requirement: "99.90" }), "gcp")
  assert.equal(selectCloud({ sla_requirement: "99.95" }), "azure")
  assert.equal(selectCloud({ sla_requirement: "99.99" }), "aws")
})

test("impossible SLA falls back to all providers", () => {
  assert.equal(selectCloud({ sla_requirement: "99.995", preferred_cloud: "azure" }), "azure")
})

test("preferred_cloud wins when no stronger rule applies", () => {
  assert.equal(selectCloud({ preferred_cloud: "azure" }), "azure")
  assert.equal(selectCloud({ preferred_cloud: "AWS" }), "aws")
  assert.equal(selectCloud({ preferred_cloud: "gcp" }), "gcp")
})

test("default provider when nothing matches", () => {
  assert.equal(selectCloud({}), "azure")
  assert.equal(selectCloud({ preferred_cloud: "invalid" }), "azure")
  assert.equal(selectCloud({ cost_preference: "invalid", latency_requirement: "unknown", sla_requirement: "invalid" }), "azure")
})

test("sla filter excludes an ineligible preferred cloud", () => {
  assert.equal(selectCloud({ preferred_cloud: "gcp", sla_requirement: "99.99" }), "aws")
})

test("evaluate returns scores and a human-readable explanation", () => {
  const result = evaluate({ cost_preference: "low", sla_requirement: "99.95" })

  assert.equal(result.selected, "aws")
  assert.deepEqual(result.eligible.sort(), ["aws", "azure"])
  assert.ok(Array.isArray(result.scores))
  assert.ok(result.scores.length === 2)
  assert.ok(result.scores[0].score > result.scores[1].score)
  assert.ok(result.explanation.some((line) => line.includes("SLA filter")))
  assert.ok(result.scores[0].reasons.length > 0)
})

test("evaluate throws when policy is invalid", () => {
  assert.throws(() => evaluate(), /Policy must be a valid object/)
  assert.throws(() => evaluate(null), /Policy must be a valid object/)
  assert.throws(() => selectCloud("policy"), /Policy must be a valid object/)
})
