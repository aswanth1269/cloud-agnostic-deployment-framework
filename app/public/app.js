/* Dashboard logic for the Cloud-Agnostic Deployment Framework. */
(function () {
  "use strict"

  var $ = function (id) { return document.getElementById(id) }

  var apiStatus = $("api-status")
  var slaSelect = $("sla_requirement")
  var form = $("deploy-form")
  var deployBtn = $("deploy-btn")
  var previewBtn = $("preview-btn")
  var terminal = $("terminal")
  var jobBadge = $("job-badge")
  var modeBadge = $("mode-badge")
  var historyBody = $("history-body")
  var decisionPanel = $("decision")
  var providersGrid = $("providers-grid")
  var statDeploys = $("stat-deploys")
  var activeStream = null

  var CLOUD_COLORS = { aws: "#ff9900", azure: "#38a6ff", gcp: "#34d97b" }
  var CLOUD_GLYPHS = { aws: "AWS", azure: "AZR", gcp: "GCP" }

  // ---------- helpers ----------

  function radioValue(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked')
    return el ? el.value : ""
  }

  function readPolicy() {
    return {
      preferred_cloud: radioValue("preferred_cloud"),
      cost_preference: radioValue("cost_preference"),
      latency_requirement: radioValue("latency_requirement"),
      sla_requirement: slaSelect.value
    }
  }

  function headers() {
    var h = { "Content-Type": "application/json" }
    var key = $("api_key").value.trim()
    if (key) h["x-api-key"] = key
    return h
  }

  function setBadge(status) {
    jobBadge.textContent = status
    var known = ["queued", "running", "succeeded", "failed"]
    jobBadge.className = "badge badge-" + (known.indexOf(status) >= 0 ? status : "idle")
  }

  function classifyLine(line) {
    if (line.indexOf("[dry-run]") === 0) return "t-dry"
    if (line.indexOf("$") === 0 || line.indexOf("  $") === 0) return "t-cmd"
    if (line.indexOf("ERROR") === 0) return "t-err"
    if (line.indexOf("Deployment successful") >= 0 || line.indexOf("Dry run complete") >= 0) return "t-ok"
    if (line.indexOf("  ") === 0) return "t-mut"
    return "t-info"
  }

  function termClear() { terminal.textContent = "" }

  function termLine(line, cls) {
    var div = document.createElement("div")
    div.className = "t-line " + (cls || classifyLine(line))
    div.textContent = line
    var prev = terminal.querySelector(".t-cursor")
    if (prev) prev.classList.remove("t-cursor")
    terminal.appendChild(div)
    terminal.scrollTop = terminal.scrollHeight
    return div
  }

  function termCursorOn() {
    var last = terminal.lastElementChild
    if (last) last.classList.add("t-cursor")
  }

  function termCursorOff() {
    var cur = terminal.querySelector(".t-cursor")
    if (cur) cur.classList.remove("t-cursor")
  }

  function closeStream() {
    if (activeStream) {
      activeStream.close()
      activeStream = null
    }
  }

  // ---------- init: health + providers ----------

  fetch("/health")
    .then(function (r) { return r.json() })
    .then(function () {
      apiStatus.innerHTML = '<span class="dot dot-ok"></span><span>API online</span>'
    })
    .catch(function () {
      apiStatus.innerHTML = '<span class="dot dot-bad"></span><span>API unreachable</span>'
    })

  function meterHtml(filled) {
    var html = '<span class="meter">'
    for (var i = 1; i <= 3; i++) {
      html += '<i class="' + (i <= filled ? "on" : "") + '"></i>'
    }
    return html + "</span>"
  }

  function renderProviders(data) {
    providersGrid.innerHTML = ""
    Object.keys(data.providers).forEach(function (key) {
      var p = data.providers[key]
      var color = CLOUD_COLORS[key] || "#4f8dff"
      var card = document.createElement("div")
      card.className = "provider-card"
      card.style.setProperty("--pc", color)

      var costBars = 4 - p.cost_index      // cheaper -> more bars
      var latBars = 4 - p.latency_index    // faster  -> more bars

      card.innerHTML =
        '<div class="provider-head">' +
          '<span class="provider-glyph">' + (CLOUD_GLYPHS[key] || key.toUpperCase()) + "</span>" +
          '<span class="provider-name">' + p.display_name + "</span>" +
        "</div>" +
        '<div class="provider-meta">' +
          "<span>SLA <strong>" + p.sla.toFixed(2) + "%</strong></span>" +
          '<span>Cost efficiency ' + meterHtml(costBars) + "</span>" +
          '<span>Latency ' + meterHtml(latBars) + "</span>" +
          "<span>Region <strong>" + (p.region_example || "—") + "</strong></span>" +
        "</div>"
      providersGrid.appendChild(card)
    })
  }

  fetch("/api/providers")
    .then(function (r) { return r.json() })
    .then(function (data) {
      slaSelect.innerHTML = '<option value="" selected disabled>Select SLA</option>'
      data.sla_options.forEach(function (sla) {
        var opt = document.createElement("option")
        opt.value = sla
        opt.textContent = sla + " %"
        slaSelect.appendChild(opt)
      })
      if (data.auth_required) $("key-field").classList.remove("hidden")
      renderProviders(data)
    })
    .catch(function () {
      slaSelect.innerHTML = '<option value="99.95">99.95 %</option>'
    })

  // ---------- api key persistence ----------

  var savedKey = localStorage.getItem("cadf_api_key")
  if (savedKey) $("api_key").value = savedKey
  $("api_key").addEventListener("change", function () {
    localStorage.setItem("cadf_api_key", $("api_key").value.trim())
  })
  $("toggle-key").addEventListener("click", function () {
    $("key-field").classList.toggle("hidden")
  })

  // ---------- dry run badge ----------

  function syncModeBadge() {
    var dry = $("dry_run").checked
    modeBadge.textContent = dry ? "dry run" : "live"
    modeBadge.className = "badge " + (dry ? "badge-idle" : "badge-running")
  }
  $("dry_run").addEventListener("change", syncModeBadge)
  syncModeBadge()

  // ---------- decision preview ----------

  function renderDecision(data) {
    decisionPanel.classList.remove("hidden")
    $("decision-cloud").textContent = data.selected_cloud

    var bars = $("score-bars")
    bars.innerHTML = ""
    var max = Math.max.apply(null, data.scores.map(function (s) { return s.score }).concat([1]))

    data.scores.forEach(function (s) {
      var row = document.createElement("div")
      row.className = "score-row" + (s.provider === data.selected_cloud ? " winner" : "")

      var name = document.createElement("span")
      name.className = "score-name"
      name.textContent = s.provider

      var track = document.createElement("div")
      track.className = "score-track"
      var fill = document.createElement("div")
      fill.className = "score-fill"
      track.appendChild(fill)

      var val = document.createElement("span")
      val.className = "score-val"
      val.textContent = s.score

      row.appendChild(name)
      row.appendChild(track)
      row.appendChild(val)
      bars.appendChild(row)

      // animate after insertion
      setTimeout(function () {
        fill.style.width = Math.max(5, Math.round((s.score / max) * 100)) + "%"
      }, 40)
    })

    var expl = $("explanation")
    expl.innerHTML = ""
    data.explanation.forEach(function (line) {
      var li = document.createElement("li")
      li.textContent = line
      expl.appendChild(li)
    })
  }

  previewBtn.addEventListener("click", function () {
    if (!slaSelect.value) {
      decisionPanel.classList.remove("hidden")
      $("decision-cloud").textContent = "—"
      $("score-bars").innerHTML = ""
      $("explanation").innerHTML = "<li>Select a minimum SLA first.</li>"
      return
    }
    previewBtn.disabled = true
    fetch("/api/policy/evaluate", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(readPolicy())
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b } }) })
      .then(function (res) {
        if (!res.ok) throw new Error(res.body.error || "evaluation failed")
        renderDecision(res.body)
      })
      .catch(function (err) {
        decisionPanel.classList.remove("hidden")
        $("decision-cloud").textContent = "error"
        $("score-bars").innerHTML = ""
        $("explanation").innerHTML = ""
        var li = document.createElement("li")
        li.textContent = err.message
        $("explanation").appendChild(li)
      })
      .finally(function () { previewBtn.disabled = false })
  })

  // ---------- deploy + live logs ----------

  function streamLogs(jobId, replayOnly) {
    closeStream()
    var source = new EventSource("/api/deployments/" + jobId + "/logs")
    activeStream = source

    source.addEventListener("log", function (event) {
      var data = JSON.parse(event.data)
      termLine(data.line)
      termCursorOn()
    })

    source.addEventListener("status", function (event) {
      var data = JSON.parse(event.data)
      setBadge(data.status)
    })

    source.addEventListener("end", function (event) {
      var data = JSON.parse(event.data)
      setBadge(data.status)
      termCursorOff()
      termLine("")
      termLine("─── " + data.status.toUpperCase() + " ───", data.status === "succeeded" ? "t-ok" : "t-err")
      source.close()
      activeStream = null
      loadHistory()
    })

    source.onerror = function () {
      if (activeStream === source) {
        source.close()
        activeStream = null
        termCursorOff()
        if (!replayOnly) setBadge("idle")
      }
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault()
    if (!slaSelect.value) {
      termClear()
      termLine("Select a minimum SLA first.", "t-err")
      return
    }

    deployBtn.disabled = true
    termClear()
    setBadge("queued")
    termLine("Submitting deployment request…", "t-mut")

    var payload = readPolicy()
    payload.dry_run = $("dry_run").checked

    fetch("/deploy", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b } }) })
      .then(function (res) {
        if (!res.ok) throw new Error(res.body.error || "deployment failed")
        termLine("Job " + res.body.job_id.slice(0, 8) + " queued → target " + res.body.selected_cloud.toUpperCase(), "t-info")
        termLine("")
        streamLogs(res.body.job_id, false)
        loadHistory()
      })
      .catch(function (err) {
        setBadge("failed")
        termLine("ERROR: " + err.message, "t-err")
      })
      .finally(function () { deployBtn.disabled = false })
  })

  // ---------- history ----------

  function loadHistory() {
    fetch("/api/deployments")
      .then(function (r) { return r.json() })
      .then(function (data) {
        var items = data.deployments || []
        statDeploys.textContent = items.length

        if (items.length === 0) {
          historyBody.innerHTML = '<tr><td colspan="5" class="empty">No deployments yet — run your first one above.</td></tr>'
          return
        }

        historyBody.innerHTML = ""
        items.slice(0, 25).forEach(function (item) {
          var tr = document.createElement("tr")
          tr.title = "Click to replay logs"

          var when = document.createElement("td")
          when.textContent = new Date(item.created_at).toLocaleString()

          var cloud = document.createElement("td")
          var tag = document.createElement("span")
          tag.className = "cloud-tag cloud-" + (item.selected_cloud || "")
          tag.textContent = item.selected_cloud || "—"
          cloud.appendChild(tag)

          var mode = document.createElement("td")
          mode.textContent = item.mode === "context" ? "real cluster" : (item.mode || "—")

          var dry = document.createElement("td")
          dry.textContent = item.dry_run ? "yes" : "no"

          var status = document.createElement("td")
          var pill = document.createElement("span")
          pill.className = "status-pill status-" + item.status
          pill.textContent = item.status
          status.appendChild(pill)

          tr.appendChild(when)
          tr.appendChild(cloud)
          tr.appendChild(mode)
          tr.appendChild(dry)
          tr.appendChild(status)

          tr.addEventListener("click", function () {
            termClear()
            setBadge(item.status)
            termLine("Replaying logs for job " + item.id.slice(0, 8) + "…", "t-mut")
            termLine("")
            streamLogs(item.id, true)
            document.getElementById("deploy").scrollIntoView({ behavior: "smooth", block: "start" })
          })

          historyBody.appendChild(tr)
        })
      })
      .catch(function () { /* keep previous table */ })
  }

  $("refresh-history").addEventListener("click", loadHistory)
  loadHistory()

  // ---------- reveal-on-scroll ----------

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in")
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12 })

    document.querySelectorAll(".reveal").forEach(function (el) { observer.observe(el) })
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in") })
  }
})()
