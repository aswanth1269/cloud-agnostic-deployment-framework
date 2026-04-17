const express = require("express")
const fs = require("fs")
const path = require("path")
const { deploy } = require("../deployment/deploy")

const PORT = 3000
const POLICY_PATH = path.join(__dirname, "..", "policy-engine", "policy.json")
const HEALTH_RESPONSE = { status: "running" }
const ALLOWED_SLA_VALUES = new Set(["99.00", "99.50", "99.90", "99.95", "99.99"])

function sanitizePolicy(body = {}) {
  return {
    preferred_cloud: String(body.preferred_cloud || "").toLowerCase(),
    cost_preference: String(body.cost_preference || "").toLowerCase(),
    latency_requirement: String(body.latency_requirement || "").toLowerCase(),
    sla_requirement: String(body.sla_requirement || "").trim()
  }
}

function validatePolicy(policy) {
  if (!policy.sla_requirement) {
    return "sla_requirement is required"
  }

  if (!ALLOWED_SLA_VALUES.has(policy.sla_requirement)) {
    return "sla_requirement must be one of: 99.00, 99.50, 99.90, 99.95, 99.99"
  }

  return null
}

function buildHomePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Policy-Driven Cloud-Agnostic Deployment Framework</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --panel: #ffffff;
      --ink: #10233d;
      --muted: #52627a;
      --accent: #1d6fff;
      --accent-2: #0c9a6b;
      --border: #d8e1ef;
      --shadow: 0 24px 60px rgba(16, 35, 61, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(29, 111, 255, 0.18), transparent 34%),
        radial-gradient(circle at top right, rgba(12, 154, 107, 0.16), transparent 26%),
        linear-gradient(180deg, #eef4ff 0%, var(--bg) 38%, #eef3f9 100%);
      min-height: 100vh;
    }
    .shell {
      max-width: 1120px;
      margin: 0 auto;
      padding: 40px 20px 56px;
    }
    .hero {
      display: grid;
      gap: 18px;
      margin-bottom: 24px;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 12px;
      color: var(--accent);
      font-weight: 700;
    }
    h1 {
      margin: 0;
      font-size: clamp(2.2rem, 4vw, 4rem);
      line-height: 0.98;
      max-width: 12ch;
    }
    .lede {
      margin: 0;
      max-width: 64ch;
      color: var(--muted);
      font-size: 1.02rem;
      line-height: 1.6;
    }
    .grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 22px;
      align-items: start;
    }
    .card {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(8px);
    }
    .form-card { padding: 24px; }
    .panel-card { padding: 24px; }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin: 20px 0;
    }
    label {
      display: block;
      font-size: 0.92rem;
      font-weight: 700;
      margin-bottom: 8px;
    }
    select, button {
      width: 100%;
      border-radius: 14px;
      border: 1px solid var(--border);
      padding: 14px 16px;
      font: inherit;
      background: #fff;
      color: var(--ink);
    }
    button {
      background: linear-gradient(135deg, var(--accent) 0%, #2452d6 100%);
      color: #fff;
      border: none;
      font-weight: 700;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
      box-shadow: 0 16px 30px rgba(29, 111, 255, 0.26);
    }
    button:hover { transform: translateY(-1px); }
    button:disabled { opacity: 0.7; cursor: wait; transform: none; }
    pre {
      margin: 0;
      padding: 16px;
      min-height: 260px;
      overflow: auto;
      border-radius: 18px;
      background: #08111f;
      color: #d8e7ff;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .status {
      margin: 0 0 14px;
      color: var(--muted);
    }
    .pill-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .pill {
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(29, 111, 255, 0.1);
      color: var(--ink);
      font-size: 0.88rem;
      font-weight: 600;
    }
    @media (max-width: 900px) {
      .grid, .field-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow">Policy-Driven Cloud Orchestration</div>
      <h1>Cloud-agnostic deployments, driven by policy.</h1>
      <p class="lede">Select a cloud, cost target, and latency target. The framework writes the policy, resolves the target provider, builds the image, loads it into Minikube, and deploys to the matching namespace.</p>
    </section>

    <section class="grid">
      <article class="card form-card">
        <form id="deploy-form">
          <div class="field-grid">
            <div>
              <label for="preferred_cloud">Preferred Cloud</label>
              <select id="preferred_cloud" name="preferred_cloud">
                <option value="">Auto</option>
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="gcp">GCP</option>
              </select>
            </div>
            <div>
              <label for="cost_preference">Cost Preference</label>
              <select id="cost_preference" name="cost_preference">
                <option value="">Any</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label for="latency_requirement">Latency Requirement</label>
              <select id="latency_requirement" name="latency_requirement">
                <option value="">Any</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label for="sla_requirement">Minimum SLA (%)</label>
              <select id="sla_requirement" name="sla_requirement" required>
                <option value="" selected disabled>Select SLA</option>
                <option value="99.00">99.00</option>
                <option value="99.50">99.50</option>
                <option value="99.90">99.90</option>
                <option value="99.95">99.95</option>
                <option value="99.99">99.99</option>
              </select>
            </div>
          </div>
          <button id="deploy-button" type="submit">Deploy</button>
        </form>
        <div class="pill-row">
          <span class="pill">Docker</span>
          <span class="pill">Minikube</span>
          <span class="pill">Kubernetes namespaces</span>
        </div>
      </article>

      <article class="card panel-card">
        <p class="status" id="status">Deployment logs appear here.</p>
        <pre id="output">Ready.</pre>
      </article>
    </section>
  </main>

  <script>
    const apiBase = window.location.origin && window.location.origin.startsWith('http')
      ? window.location.origin
      : 'http://localhost:3000'
    const form = document.getElementById('deploy-form')
    const statusNode = document.getElementById('status')
    const outputNode = document.getElementById('output')
    const deployButton = document.getElementById('deploy-button')

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      deployButton.disabled = true
      statusNode.textContent = 'Submitting deployment request...'
      outputNode.textContent = 'Reading policy...'

      const payload = {
        preferred_cloud: document.getElementById('preferred_cloud').value,
        cost_preference: document.getElementById('cost_preference').value,
        latency_requirement: document.getElementById('latency_requirement').value,
        sla_requirement: document.getElementById('sla_requirement').value
      }

      try {
        const response = await fetch(apiBase + '/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || 'Deployment failed')
        }

        statusNode.textContent = 'Selected cloud: ' + result.selected_cloud.toUpperCase()
        outputNode.textContent = (result.logs || []).join('\\n') || JSON.stringify(result, null, 2)
      } catch (error) {
        statusNode.textContent = 'Deployment failed'
        outputNode.textContent = error.message
      } finally {
        deployButton.disabled = false
      }
    })
  </script>
</body>
</html>`
}

function createApp(options = {}) {
  const deployFn = options.deployFn || deploy
  const policyPath = options.policyPath || POLICY_PATH
  const app = express()

  app.use(express.json())
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }

    next()
  })

  app.get('/', (_req, res) => {
    res.type('html').send(buildHomePage())
  })

  app.get('/health', (_req, res) => {
    res.json(HEALTH_RESPONSE)
  })

  app.post('/deploy', async (req, res) => {
    try {
      const policy = sanitizePolicy(req.body)
      const validationError = validatePolicy(policy)
      if (validationError) {
        res.status(400).json({
          selected_cloud: null,
          status: 'deployment failed',
          error: validationError
        })
        return
      }

      fs.writeFileSync(policyPath, JSON.stringify({ deployment_policy: policy }, null, 2))

      const result = await Promise.resolve(deployFn({ policyPath }))
      res.json({
        selected_cloud: result.selected_cloud,
        status: result.status,
        logs: result.logs || []
      })
    } catch (error) {
      res.status(500).json({
        selected_cloud: null,
        status: 'deployment failed',
        error: error.message
      })
    }
  })

  return app
}

const app = createApp()

function startServer(port = PORT, options = {}) {
  const serverApp = createApp(options)
  return serverApp.listen(port, function onListen() {
    const actualPort = this.address().port
    console.log('Cloud-Agnostic Demo API')
    console.log(`Server running on port ${actualPort}`)
    console.log(`Demo app available at http://localhost:${actualPort}`)
  })
}

if (require.main === module) {
  startServer()
}

module.exports = {
  app,
  createApp,
  startServer,
  validatePolicy,
  sanitizePolicy,
  buildHomePage
}