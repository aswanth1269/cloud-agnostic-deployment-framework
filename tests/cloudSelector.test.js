const test = require("node:test")
const assert = require("node:assert/strict")
const { selectCloud } = require("../policy-engine/cloudSelector")

test("selectCloud prioritizes low cost", () => {
  assert.equal(selectCloud({ preferred_cloud: "azure", cost_preference: "low" }), "aws")
  assert.equal(selectCloud({ cost_preference: "low" }), "aws")
})

test("selectCloud falls back to latency_requirement", () => {
  assert.equal(selectCloud({ preferred_cloud: "invalid", latency_requirement: "low" }), "gcp")
  assert.equal(selectCloud({ latency_requirement: "low" }), "gcp")
})

test("selectCloud uses sla_requirement after cost and latency", () => {
  assert.equal(selectCloud({ sla_requirement: "99.00" }), "gcp")
  assert.equal(selectCloud({ sla_requirement: "99.50" }), "gcp")
  assert.equal(selectCloud({ sla_requirement: "99.90" }), "gcp")
  assert.equal(selectCloud({ sla_requirement: "99.95" }), "azure")
  assert.equal(selectCloud({ sla_requirement: "99.99" }), "aws")
  assert.equal(selectCloud({ sla_requirement: "99.995", preferred_cloud: "azure" }), "azure")
})

test("selectCloud uses preferred_cloud after priority checks", () => {
  assert.equal(selectCloud({ preferred_cloud: "azure" }), "azure")
  assert.equal(selectCloud({ preferred_cloud: "AWS" }), "aws")
})

test("selectCloud returns default when no rules match", () => {
  assert.equal(selectCloud({}), "azure")
  assert.equal(selectCloud({ cost_preference: "invalid", latency_requirement: "unknown", sla_requirement: "invalid" }), "azure")
  assert.equal(selectCloud({ preferred_cloud: "invalid" }), "azure")
})

test("selectCloud throws when policy is invalid", () => {
  assert.throws(() => selectCloud(), /Policy must be a valid object/)
  assert.throws(() => selectCloud(null), /Policy must be a valid object/)
})
