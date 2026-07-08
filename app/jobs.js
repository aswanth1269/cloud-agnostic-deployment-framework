const crypto = require("crypto")

/**
 * In-process serial job queue for deployments.
 *
 * Deploys are long-running, so POST /deploy only enqueues a job and
 * returns 202 immediately. Clients follow progress over Server-Sent
 * Events (GET /api/deployments/:id/logs). Jobs run one at a time -
 * concurrent `kubectl`/`docker` invocations against the same cluster
 * are a recipe for races.
 *
 * Swap-out path for scale: BullMQ + Redis with the same interface.
 */
class JobManager {
  constructor({ deployFn, historyStore, logger = console }) {
    this.deployFn = deployFn
    this.historyStore = historyStore
    this.logger = logger
    this.jobs = new Map()
    this.queue = []
    this.running = false
    this.subscribers = new Map() // jobId -> Set<res>
  }

  create({ policy, dryRun, selectedCloud }) {
    const job = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      finished_at: null,
      status: "queued",
      dry_run: Boolean(dryRun),
      policy,
      selected_cloud: selectedCloud || null,
      namespace: null,
      mode: null,
      image: null,
      error: null,
      logs: []
    }

    this.jobs.set(job.id, job)
    this.queue.push(job.id)
    queueMicrotask(() => this.drain())
    return job
  }

  get(id) {
    return this.jobs.get(id) || (this.historyStore ? this.historyStore.get(id) : null)
  }

  list() {
    const seen = new Set()
    const combined = []

    for (const job of this.jobs.values()) {
      seen.add(job.id)
      combined.push(this.snapshot(job))
    }
    if (this.historyStore) {
      for (const entry of this.historyStore.list()) {
        if (!seen.has(entry.id)) combined.push(entry)
      }
    }

    return combined.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  }

  snapshot(job) {
    const { logs, ...rest } = job
    return { ...rest, log_count: logs.length }
  }

  appendLog(job, line) {
    job.logs.push(line)
    this.emit(job.id, { type: "log", line })
  }

  subscribe(jobId, res) {
    if (!this.subscribers.has(jobId)) this.subscribers.set(jobId, new Set())
    this.subscribers.get(jobId).add(res)
  }

  unsubscribe(jobId, res) {
    const set = this.subscribers.get(jobId)
    if (set) {
      set.delete(res)
      if (set.size === 0) this.subscribers.delete(jobId)
    }
  }

  emit(jobId, event) {
    const set = this.subscribers.get(jobId)
    if (!set) return
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
    for (const res of set) {
      res.write(payload)
    }
  }

  closeSubscribers(jobId) {
    const set = this.subscribers.get(jobId)
    if (!set) return
    for (const res of set) res.end()
    this.subscribers.delete(jobId)
  }

  async drain() {
    if (this.running) return
    const jobId = this.queue.shift()
    if (!jobId) return

    this.running = true
    const job = this.jobs.get(jobId)
    job.status = "running"
    this.emit(job.id, { type: "status", status: "running" })

    try {
      const result = await this.deployFn({
        policy: job.policy,
        dryRun: job.dry_run,
        quiet: true,
        onLog: (line) => this.appendLog(job, line)
      })
      job.status = "succeeded"
      job.selected_cloud = result.selected_cloud
      job.namespace = result.namespace
      job.mode = result.mode
      job.image = result.image
    } catch (error) {
      job.status = "failed"
      job.error = error.message
      this.appendLog(job, `ERROR: ${error.message}`)
      if (error.stderr) this.appendLog(job, String(error.stderr).trim())
    }

    job.finished_at = new Date().toISOString()
    this.emit(job.id, { type: "end", status: job.status })
    this.closeSubscribers(job.id)

    if (this.historyStore) {
      this.historyStore.append({ ...job })
    }
    this.jobs.delete(job.id)

    this.running = false
    queueMicrotask(() => this.drain())
  }
}

module.exports = { JobManager }
