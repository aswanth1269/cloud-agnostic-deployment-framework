import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

function classify(line) {
  if (line.startsWith("[dry-run]")) return "t-dry"
  if (line.startsWith("$") || line.startsWith("  $")) return "t-cmd"
  if (line.startsWith("ERROR")) return "t-err"
  if (line.includes("Deployment successful") || line.includes("Dry run complete")) return "t-ok"
  if (line.startsWith("  ")) return "t-mut"
  return "t-info"
}

export default function Terminal({ lines, status, streaming }) {
  const boxRef = useRef(null)

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [lines])

  return (
    <article className="card terminal-card">
      <div className="terminal-chrome">
        <span className="tl tl-r" /><span className="tl tl-y" /><span className="tl tl-g" />
        <span className="terminal-title">deployment logs</span>
        <span className={"badge badge-" + (["queued", "running", "succeeded", "failed"].includes(status) ? status : "idle")}>
          {status}
        </span>
      </div>
      <div className="terminal" ref={boxRef} aria-live="polite">
        {lines.length === 0 && (
          <div className="t-line t-mut">Ready. Launch a deployment or click a history row to replay its logs.</div>
        )}
        <AnimatePresence initial={false}>
          {lines.map((entry, i) => (
            <motion.div
              key={i}
              className={"t-line " + (entry.cls || classify(entry.line))}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.16 }}
            >
              {entry.line || " "}
              {streaming && i === lines.length - 1 && (
                <motion.span
                  className="cursor"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </article>
  )
}
