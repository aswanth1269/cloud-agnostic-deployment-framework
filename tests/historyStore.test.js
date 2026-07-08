const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { HistoryStore } = require("../app/historyStore")

test("history store persists and reloads entries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "history-store-test-"))
  const filePath = path.join(dir, "nested", "deployments.json")

  try {
    const store = new HistoryStore({ filePath, maxEntries: 3, logger: { warn: () => {} } })
    store.append({ id: "a", created_at: "2026-01-01T00:00:00Z", status: "succeeded" })
    store.append({ id: "b", created_at: "2026-01-02T00:00:00Z", status: "failed" })

    const reloaded = new HistoryStore({ filePath, logger: { warn: () => {} } })
    assert.equal(reloaded.list().length, 2)
    assert.equal(reloaded.list()[0].id, "b")
    assert.equal(reloaded.get("a").status, "succeeded")
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("history store trims to maxEntries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "history-store-trim-"))
  const filePath = path.join(dir, "deployments.json")

  try {
    const store = new HistoryStore({ filePath, maxEntries: 2, logger: { warn: () => {} } })
    store.append({ id: "1", created_at: "2026-01-01T00:00:00Z" })
    store.append({ id: "2", created_at: "2026-01-02T00:00:00Z" })
    store.append({ id: "3", created_at: "2026-01-03T00:00:00Z" })

    assert.equal(store.list().length, 2)
    assert.equal(store.get("1"), null)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("history store survives a corrupt file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "history-store-corrupt-"))
  const filePath = path.join(dir, "deployments.json")
  fs.writeFileSync(filePath, "{ not json", "utf8")

  try {
    const store = new HistoryStore({ filePath, logger: { warn: () => {} } })
    assert.deepEqual(store.list(), [])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
