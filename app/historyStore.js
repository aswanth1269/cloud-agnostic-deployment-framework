const fs = require("fs")
const path = require("path")

/**
 * Small JSON-file-backed store for deployment history.
 * Interface (list/get/append) is intentionally minimal so it can be
 * swapped for Postgres/SQLite without touching the rest of the app.
 */
class HistoryStore {
  constructor({ filePath, maxEntries = 200, logger = console } = {}) {
    this.filePath = filePath
    this.maxEntries = maxEntries
    this.logger = logger
    this.entries = []
    this.load()
  }

  load() {
    if (!this.filePath) return
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8")
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) this.entries = parsed
      }
    } catch (error) {
      this.logger.warn ? this.logger.warn(`History load failed: ${error.message}`)
        : console.warn(`History load failed: ${error.message}`)
      this.entries = []
    }
  }

  persist() {
    if (!this.filePath) return
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2), "utf8")
    } catch (error) {
      const warn = this.logger.warn ? this.logger.warn.bind(this.logger) : console.warn
      warn(`History persist failed (continuing in memory): ${error.message}`)
    }
  }

  list() {
    return [...this.entries].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  }

  get(id) {
    return this.entries.find((entry) => entry.id === id) || null
  }

  append(entry) {
    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries)
    }
    this.persist()
  }
}

module.exports = { HistoryStore }
