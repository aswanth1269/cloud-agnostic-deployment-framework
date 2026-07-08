import { motion } from "framer-motion"

export default function HistoryTable({ items, onReplay, onRefresh }) {
  return (
    <motion.section
      className="card table-card"
      id="history"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
    >
      <div className="table-head">
        <h2>Deployment history</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh}>↻ Refresh</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Started</th><th>Cloud</th><th>Mode</th><th>Dry run</th><th>Status</th></tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan="5" className="empty">No deployments yet — run your first one above.</td></tr>
            )}
            {items.slice(0, 25).map((item) => (
              <motion.tr
                key={item.id}
                onClick={() => onReplay(item)}
                title="Click to replay logs"
                whileHover={{ backgroundColor: "rgba(79,141,255,0.07)" }}
              >
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td><span className={"cloud-tag cloud-" + (item.selected_cloud || "")}>{item.selected_cloud || "—"}</span></td>
                <td>{item.mode === "context" ? "real cluster" : item.mode || "—"}</td>
                <td>{item.dry_run ? "yes" : "no"}</td>
                <td><span className={"status-pill status-" + item.status}>{item.status}</span></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.section>
  )
}
