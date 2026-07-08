import { motion } from "framer-motion"

export default function Navbar({ apiOnline }) {
  return (
    <motion.header
      className="topbar"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      <div className="brand">
        <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4f8dff" />
              <stop offset="1" stopColor="#22e0a8" />
            </linearGradient>
          </defs>
          <path d="M16 3 29 10.5v11L16 29 3 21.5v-11L16 3z" fill="none" stroke="url(#lg)" strokeWidth="2" />
          <circle cx="16" cy="16" r="4.5" fill="url(#lg)" />
        </svg>
        <span className="brand-name">CADF</span>
        <span className="brand-sub">Cloud-Agnostic Deployment Framework</span>
      </div>
      <nav className="nav">
        <a href="#deploy">Deploy</a>
        <a href="#history">History</a>
        <a href="#pipeline">Pipeline</a>
        <a href="https://github.com/aswanth1269/cloud-agnostic-deployment-framework" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </nav>
      <div className="api-status">
        <span className={"dot " + (apiOnline === null ? "dot-wait" : apiOnline ? "dot-ok" : "dot-bad")} />
        <span>{apiOnline === null ? "checking API…" : apiOnline ? "API online" : "API unreachable"}</span>
      </div>
    </motion.header>
  )
}
