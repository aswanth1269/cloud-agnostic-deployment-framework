import { motion } from "framer-motion"
import CountUp from "./animations/CountUp.jsx"

export default function Stats({ deployCount }) {
  const items = [
    { value: 3, label: "cloud targets" },
    { value: 37, label: "automated tests" },
    { value: deployCount, label: "deployments run" },
    { value: 0, label: "vendor lock-ins" }
  ]

  return (
    <motion.section
      className="stats"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55 }}
    >
      {items.map((item) => (
        <div className="stat" key={item.label}>
          <span className="stat-num">
            <CountUp to={item.value} />
          </span>
          <span className="stat-label">{item.label}</span>
        </div>
      ))}
    </motion.section>
  )
}
