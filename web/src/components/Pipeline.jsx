import { motion } from "framer-motion"

const STEPS = [
  {
    num: "01",
    title: "Declare policy",
    body: "Cost, latency and SLA targets. Provider characteristics live in providers.json — the logic is data, not code."
  },
  {
    num: "02",
    title: "Score providers",
    body: "SLA hard-filter, then weighted scoring across cost and latency fit. Every decision ships with a full explanation."
  },
  {
    num: "03",
    title: "Build & ship",
    body: "An async job builds the container, pushes to GHCR (or loads into Minikube) and applies the kustomize overlay."
  },
  {
    num: "04",
    title: "Reconcile",
    body: "In GitOps mode Argo CD keeps clusters in sync with the policy-selected overlay. CI builds — Argo deploys."
  }
]

export default function Pipeline() {
  return (
    <section className="pipeline" id="pipeline">
      <motion.h2
        className="section-title"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        From policy to production
      </motion.h2>
      <motion.p
        className="section-sub"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.08 }}
      >
        Every deployment flows through four stages — each one observable, each one testable.
      </motion.p>
      <div className="steps">
        {STEPS.map((step, index) => (
          <motion.div
            className="step"
            key={step.num}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            whileHover={{ y: -4 }}
          >
            <div className="step-top">
              <span className="step-num">{step.num}</span>
            </div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
