const express = require("express")

// Initialize Express application
const app = express()

// Main endpoint - returns framework demo message
app.get("/", (req, res) => {
  res.send("Cloud Agnostic Deployment Framework Demo")
})

// Health check endpoint - used for Kubernetes liveness/readiness probes
app.get("/health", (req, res) => {
  res.json({ status: "running" })
})

const PORT = 3000

// Exported for tests and for direct startup when run as a script
function startServer(port = PORT) {
  return app.listen(port, function onListen() {
    const actualPort = this.address().port
    console.log(`Server running on port ${actualPort}`)
    console.log(`Demo app available at http://localhost:${actualPort}`)
  })
}

if (require.main === module) {
  startServer()
}

module.exports = {
  app,
  startServer
}
