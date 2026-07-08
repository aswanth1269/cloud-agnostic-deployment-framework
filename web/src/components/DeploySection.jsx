import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import Segmented from "./Segmented.jsx"
import DecisionPanel from "./DecisionPanel.jsx"
import Terminal from "./Terminal.jsx"
import { api, getApiKey, setApiKey } from "../lib/api.js"

const CLOUD_OPTIONS = [
  { value: "", label: "Auto" },
  { value: "aws", label: "AWS" },
  { value: "azure", label: "Azure" },
  { value: "gcp", label: "GCP" }
]
const LEVEL_OPTIONS = [
  { value: "", label: "Any" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" }
]

export default function DeploySection({ slaOptions, authRequired, onDeployed, registerReplay }) {
  const [cloud, setCloud] = useState("")
  const [cost, setCost] = useState("")
  const [latency, setLatency] = useState("")
  const [sla, setSla] = useState("")
  const [dryRun, setDryRun] = useState(true)
  const [showKey, setShowKey] = useState(authRequired)
  const [busy, setBusy] = useState(false)
  const [decision, setDecision] = useState(null)
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState("idle")
  const [streaming, setStreaming] = useState(false)
  const streamRef = useRef(null)

  const policy = { preferred_cloud: cloud, cost_preference: cost, latency_requirement: latency, sla_requirement: sla }

  function pushLine(line, cls) {
    setLines((prev) => [...prev, { line, cls }])
  }

  function closeStream() {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
    setStreaming(false)
  }

  function streamLogs(jobId, replayStatus) {
    closeStream()
    setStreaming(true)
    const source = api.logStream(jobId)
    streamRef.current = source

    source.addEventListener("log", (event) => {
      const data = JSON.parse(event.data)
      pushLine(data.line)
    })
    source.addEventListener("status", (event) => {
      setStatus(JSON.parse(event.data).status)
    })
    source.addEventListener("end", (event) => {
      const data = JSON.parse(event.data)
      setStatus(data.status)
      pushLine("")
      pushLine(`─── ${data.status.toUpperCase()} ───`, data.status === "succeeded" ? "t-ok" : "t-err")
      source.close()
      streamRef.current = null
      setStreaming(false)
      onDeployed()
    })
    source.onerror = () => {
      if (streamRef.current === source) {
        source.close()
        streamRef.current = null
        setStreaming(false)
        if (replayStatus) setStatus(replayStatus)
      }
    }
  }

  async function preview() {
    if (!sla) {
      setDecision({ selected_cloud: "—", scores: [], explanation: ["Select a minimum SLA first."] })
      return
    }
    setBusy(true)
    try {
      setDecision(await api.evaluate(policy))
    } catch (error) {
      setDecision({ selected_cloud: "error", scores: [], explanation: [error.message] })
    } finally {
      setBusy(false)
    }
  }

  async function deploy(event) {
    event.preventDefault()
    if (!sla) {
      setLines([{ line: "Select a minimum SLA first.", cls: "t-err" }])
      return
    }
    setBusy(true)
    setLines([])
    setStatus("queued")
    pushLine("Submitting deployment request…", "t-mut")
    try {
      const res = await api.deploy({ ...policy, dry_run: dryRun })
      pushLine(`Job ${res.job_id.slice(0, 8)} queued → target ${res.selected_cloud.toUpperCase()}`, "t-info")
      pushLine("")
      streamLogs(res.job_id)
      onDeployed()
    } catch (error) {
      setStatus("failed")
      pushLine(`ERROR: ${error.message}`, "t-err")
    } finally {
      setBusy(false)
    }
  }

  function replay(item) {
    setLines([{ line: `Replaying logs for job ${item.id.slice(0, 8)}…`, cls: "t-mut" }, { line: "" }])
    setStatus(item.status)
    streamLogs(item.id, item.status)
    document.getElementById("deploy")?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (registerReplay) registerReplay(replay)
  })

  return (
    <section className="grid" id="deploy">
      <motion.article
        className="card"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <div className="card-head">
          <h2>New deployment</h2>
          <span className={"badge " + (dryRun ? "badge-idle" : "badge-running")}>{dryRun ? "dry run" : "live"}</span>
        </div>

        <form onSubmit={deploy}>
          <Segmented label="Preferred cloud" group="cloud" options={CLOUD_OPTIONS} value={cloud} onChange={setCloud} />
          <Segmented label="Cost preference" group="cost" options={LEVEL_OPTIONS} value={cost} onChange={setCost} />
          <Segmented label="Latency requirement" group="latency" options={LEVEL_OPTIONS} value={latency} onChange={setLatency} />

          <div className="row-2">
            <div className="field">
              <label htmlFor="sla">Minimum SLA (%)</label>
              <select id="sla" value={sla} onChange={(e) => setSla(e.target.value)} required>
                <option value="" disabled>Select SLA</option>
                {slaOptions.map((option) => (
                  <option key={option} value={option}>{option} %</option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="seg-label">Execution</span>
              <div className="toggle" onClick={() => setDryRun(!dryRun)} role="switch" aria-checked={dryRun} tabIndex={0}>
                <span className={"toggle-track" + (dryRun ? " on" : "")}>
                  <motion.span className="toggle-thumb" animate={{ x: dryRun ? 21 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                </span>
                <span className="toggle-text">Dry run</span>
              </div>
            </div>
          </div>

          {showKey && (
            <div className="field key-field">
              <label htmlFor="api-key">API key <span className="mut">(sent as x-api-key)</span></label>
              <input
                id="api-key"
                type="password"
                autoComplete="off"
                defaultValue={getApiKey()}
                placeholder={authRequired ? "required — server has API_KEY set" : "optional"}
                onChange={(e) => setApiKey(e.target.value.trim())}
              />
            </div>
          )}

          <div className="btn-row">
            <motion.button type="button" className="btn btn-ghost btn-block" onClick={preview} disabled={busy} whileTap={{ scale: 0.97 }}>
              Preview decision
            </motion.button>
            <motion.button type="submit" className="btn btn-primary btn-block" disabled={busy} whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }}>
              Deploy
            </motion.button>
          </div>
          {!authRequired && (
            <button type="button" className="link-btn" onClick={() => setShowKey(!showKey)}>API key settings</button>
          )}
        </form>

        <DecisionPanel decision={decision} />
      </motion.article>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ display: "flex" }}
      >
        <Terminal lines={lines} status={status} streaming={streaming} />
      </motion.div>
    </section>
  )
}
