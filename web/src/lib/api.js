const KEY_STORAGE = "cadf_api_key"

export function getApiKey() {
  try { return localStorage.getItem(KEY_STORAGE) || "" } catch { return "" }
}

export function setApiKey(value) {
  try { localStorage.setItem(KEY_STORAGE, value) } catch { /* private mode */ }
}

function headers() {
  const h = { "Content-Type": "application/json" }
  const key = getApiKey()
  if (key) h["x-api-key"] = key
  return h
}

async function parse(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `request failed (${res.status})`)
  return body
}

export const api = {
  health: () => fetch("/health").then(parse),
  providers: () => fetch("/api/providers").then(parse),
  evaluate: (policy) =>
    fetch("/api/policy/evaluate", { method: "POST", headers: headers(), body: JSON.stringify(policy) }).then(parse),
  deploy: (payload) =>
    fetch("/deploy", { method: "POST", headers: headers(), body: JSON.stringify(payload) }).then(parse),
  deployments: () => fetch("/api/deployments").then(parse),
  logStream: (jobId) => new EventSource(`/api/deployments/${jobId}/logs`)
}
