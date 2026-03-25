const test = require("node:test")
const assert = require("node:assert/strict")
const { selectCloud } = require("../policy-engine/cloudSelector")

test("selectCloud uses preferred_cloud when valid", () => {
  assert.equal(selectCloud({ preferred_cloud: "azure", cost_preference: "low" }), "azure")
  assert.equal(selectCloud({ preferred_cloud: "AWS" }), "aws")
})

test("selectCloud falls back to cost_preference", () => {
  assert.equal(selectCloud({ preferred_cloud: "invalid", cost_preference: "low" }), "gcp")
  assert.equal(selectCloud({ cost_preference: "medium" }), "azure")
  assert.equal(selectCloud({ cost_preference: "high" }), "aws")
})

test("selectCloud falls back to latency_requirement", () => {
  assert.equal(selectCloud({ latency_requirement: "low" }), "aws")
  assert.equal(selectCloud({ latency_requirement: "medium" }), "azure")
  assert.equal(selectCloud({ latency_requirement: "high" }), "gcp")
})

test("selectCloud returns default when no rules match", () => {
  assert.equal(selectCloud({}), "aws")
  assert.equal(selectCloud({ cost_preference: "invalid", latency_requirement: "unknown" }), "aws")
})

test("selectCloud throws when policy is invalid", () => {
  assert.throws(() => selectCloud(), /Policy must be a valid object/)
  assert.throws(() => selectCloud(null), /Policy must be a valid object/)
})
