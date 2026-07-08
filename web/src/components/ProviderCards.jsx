import { motion } from "framer-motion"
import TiltCard from "./animations/TiltCard.jsx"
import CountUp from "./animations/CountUp.jsx"

const COLORS = { aws: "#ff9900", azure: "#38a6ff", gcp: "#34d97b" }
const GLYPHS = { aws: "AWS", azure: "AZR", gcp: "GCP" }

function Meter({ filled }) {
  return (
    <span className="meter">
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= filled ? "on" : ""} />
      ))}
    </span>
  )
}

export default function ProviderCards({ providers }) {
  if (!providers) return null

  return (
    <section className="providers-grid">
      {Object.entries(providers).map(([key, p], index) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: index * 0.12, duration: 0.5 }}
        >
          <TiltCard className="provider-card" style={{ "--pc": COLORS[key] || "#4f8dff" }}>
            <div className="provider-head">
              <span className="provider-glyph">{GLYPHS[key] || key.toUpperCase()}</span>
              <span className="provider-name">{p.display_name}</span>
            </div>
            <p className="provider-sla">
              <CountUp to={p.sla} decimals={2} suffix="%" /> <small>SLA</small>
            </p>
            <div className="provider-meta">
              <span>Cost efficiency <Meter filled={4 - p.cost_index} /></span>
              <span>Latency <Meter filled={4 - p.latency_index} /></span>
              <span>Region example — <strong>{p.region_example || "n/a"}</strong></span>
            </div>
          </TiltCard>
        </motion.div>
      ))}
    </section>
  )
}
