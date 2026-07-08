import { motion, AnimatePresence } from "framer-motion"

export default function DecisionPanel({ decision }) {
  if (!decision) return null
  const max = Math.max(...decision.scores.map((s) => s.score), 1)

  return (
    <AnimatePresence>
      <motion.div
        className="decision"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="decision-head">
          <h3>Policy decision</h3>
          <motion.span
            className="cloud-pill"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.15 }}
          >
            {decision.selected_cloud}
          </motion.span>
        </div>
        <div className="score-bars">
          {decision.scores.map((score, index) => (
            <div className={"score-row" + (score.provider === decision.selected_cloud ? " winner" : "")} key={score.provider}>
              <span className="score-name">{score.provider}</span>
              <div className="score-track">
                <motion.div
                  className="score-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(5, Math.round((score.score / max) * 100))}%` }}
                  transition={{ delay: 0.15 + index * 0.12, duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
                />
              </div>
              <span className="score-val">{score.score}</span>
            </div>
          ))}
        </div>
        <ul className="explanation">
          {decision.explanation.map((line, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              {line}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </AnimatePresence>
  )
}
