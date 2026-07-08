import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import Navbar from "./components/Navbar.jsx"
import Hero3D from "./components/Hero3D.jsx"
import Stats from "./components/Stats.jsx"
import ProviderCards from "./components/ProviderCards.jsx"
import DeploySection from "./components/DeploySection.jsx"
import HistoryTable from "./components/HistoryTable.jsx"
import Pipeline from "./components/Pipeline.jsx"
import SplitText from "./components/animations/SplitText.jsx"
import BlurText from "./components/animations/BlurText.jsx"
import Magnetic from "./components/animations/Magnetic.jsx"
import { api } from "./lib/api.js"

const CHIPS = ["Docker", "Kubernetes", "Kustomize", "Argo CD", "Terraform", "GitHub Actions"]

export default function App() {
  const [apiOnline, setApiOnline] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [history, setHistory] = useState([])
  const replayRef = useRef(null)

  const loadHistory = useCallback(() => {
    api.deployments()
      .then((data) => setHistory(data.deployments || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    api.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false))
    api.providers().then(setCatalog).catch(() => {})
    loadHistory()
  }, [loadHistory])

  return (
    <>
      <div className="bg-fx" aria-hidden="true">
        <motion.div className="bg-blob bg-a" animate={{ x: [0, 70, 0], y: [0, -40, 0] }} transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="bg-blob bg-b" animate={{ x: [0, -60, 0], y: [0, 50, 0] }} transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="bg-blob bg-c" animate={{ x: [0, 50, 0], y: [0, -60, 0] }} transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }} />
      </div>
      <div className="bg-grid" aria-hidden="true" />

      <Navbar apiOnline={apiOnline} />

      <main className="shell">
        <section className="hero">
          <div>
            <motion.p className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              Policy-driven cloud orchestration
            </motion.p>
            <h1>
              <SplitText text="Deploy " delay={0.15} />
              <SplitText text="anywhere" className="grad-text" delay={0.4} />
              <SplitText text="." delay={0.7} />
              <br />
              <SplitText text="Locked in " delay={0.8} />
              <SplitText text="nowhere" className="grad-text-2" delay={1.1} />
              <SplitText text="." delay={1.4} />
            </h1>
            <p className="lede">
              <BlurText
                delay={1.2}
                text="Declare what matters — cost, latency, SLA — and the weighted policy engine scores AWS, Azure and GCP to pick your target. Async jobs, live log streaming, GitOps-ready manifests."
              />
            </p>
            <motion.div className="hero-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.9 }}>
              <Magnetic><a className="btn btn-primary btn-lg" href="#deploy">Launch a deployment</a></Magnetic>
              <Magnetic><a className="btn btn-ghost btn-lg" href="#pipeline">See the pipeline</a></Magnetic>
            </motion.div>
            <motion.div className="chip-row" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 2.1 } } }}>
              {CHIPS.map((chip) => (
                <motion.span
                  key={chip}
                  className="chip shiny"
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                >
                  {chip}
                </motion.span>
              ))}
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.3 }}>
            <Hero3D />
          </motion.div>
        </section>

        <Stats deployCount={history.length} />
        <ProviderCards providers={catalog?.providers} />

        <DeploySection
          slaOptions={catalog?.sla_options || ["99.00", "99.50", "99.90", "99.95", "99.99"]}
          authRequired={Boolean(catalog?.auth_required)}
          onDeployed={loadHistory}
          registerReplay={(fn) => { replayRef.current = fn }}
        />

        <HistoryTable
          items={history}
          onRefresh={loadHistory}
          onReplay={(item) => replayRef.current && replayRef.current(item)}
        />

        <Pipeline />
      </main>

      <footer className="footer">
        <p>
          Cloud-Agnostic Deployment Framework · MIT License ·{" "}
          <a href="https://github.com/aswanth1269/cloud-agnostic-deployment-framework" target="_blank" rel="noreferrer">Source on GitHub</a>
        </p>
      </footer>
    </>
  )
}
