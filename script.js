/* ── Customer Health Dashboard · script.js ─────────────────────────── */

let DATA = null;
let historyChart = null;
let fridayMode = false; // default: Before Friday

// Health sort order for display
const HEALTH_ORDER = { Red: 0, nodata: 1, Yellow: 2, Green: 3 };
const HEALTH_LABEL = { Green: "Green", Yellow: "Yellow", Red: "Red", nodata: "No data" };

// ── Boot ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("data.json");
    DATA = await res.json();
    init();
  } catch (e) {
    document.body.innerHTML =
      `<div style="padding:40px;font-family:system-ui;color:#b91c1c">
        Failed to load data.json. Make sure you are serving this over HTTP, not file://.
        <br><br><code>${e.message}</code>
      </div>`;
  }
});

function init() {
  // Nav
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // Toggle
  document.getElementById("toggleBefore").addEventListener("click", () => setFridayMode(false));
  document.getElementById("toggleFriday").addEventListener("click", () => setFridayMode(true));

  // Modal close
  document.getElementById("modalOverlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  // History account selector
  document.getElementById("accountSelect").addEventListener("change", e => {
    renderHistoryChart(e.target.value);
  });

  // Populate history dropdown
  populateHistorySelect();

  // Initial render
  renderStatsBar();
  renderAccountGrid();
}

// ── View switching ────────────────────────────────────────────────────
function switchView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("view-" + viewId).classList.add("active");
  document.querySelector(`[data-view="${viewId}"]`).classList.add("active");

  if (viewId === "history") {
    const sel = document.getElementById("accountSelect");
    if (sel.value) renderHistoryChart(sel.value);
  }
  if (viewId === "syshealth") renderSysHealth();
}

// ── Friday toggle ─────────────────────────────────────────────────────
function setFridayMode(on) {
  fridayMode = on;
  document.getElementById("toggleBefore").classList.toggle("selected", !on);
  document.getElementById("toggleFriday").classList.toggle("selected", on);
  document.getElementById("toggleHint").textContent = on
    ? "All 20 accounts — click any card for the full drill-down."
    : "Data not yet generated — switch to Friday to see account summaries.";
  renderAccountGrid();
}

// ── Stats bar ─────────────────────────────────────────────────────────
function renderStatsBar() {
  const counts = { Green: 0, Yellow: 0, Red: 0, nodata: 0 };
  DATA.accounts.forEach(a => counts[a.health]++);
  document.getElementById("countGreen").textContent  = counts.Green;
  document.getElementById("countYellow").textContent = counts.Yellow;
  document.getElementById("countRed").textContent    = counts.Red;
  document.getElementById("countNodata").textContent = counts.nodata;
}

// ── Account grid ──────────────────────────────────────────────────────
function renderAccountGrid() {
  const grid = document.getElementById("accountsGrid");
  grid.innerHTML = "";

  const sorted = [...DATA.accounts].sort(
    (a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]
  );

  sorted.forEach(acct => {
    const card = fridayMode ? buildCard(acct) : buildSkeletonCard(acct);
    grid.appendChild(card);
  });
}

function buildCard(acct) {
  const card = document.createElement("div");
  card.className = "account-card";
  card.dataset.id = acct.id;

  const hasTickets = acct.tickets && acct.tickets.length > 0;
  const openTickets = hasTickets ? acct.tickets.filter(t => t.status === "Open").length : 0;
  const ticketNote = openTickets > 0
    ? `<span style="color:var(--red);font-weight:600">${openTickets} open ticket${openTickets > 1 ? "s" : ""}</span>`
    : (hasTickets ? `<span style="color:var(--text-3)">${acct.tickets.length} ticket${acct.tickets.length>1?'s':''} resolved</span>` : `<span style="color:var(--text-3)">No tickets</span>`);

  card.innerHTML = `
    <div class="card-header">
      <div class="card-name">${esc(acct.name)}</div>
      <span class="health-badge ${acct.health}">${HEALTH_LABEL[acct.health]}</span>
    </div>
    <div class="card-meta">
      <div class="row">
        <span class="meta-tag">${esc(acct.sector)}</span>
        <span class="meta-tag">CSM: ${esc(acct.csm)}</span>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-arr">${fmtARR(acct.arr)}</span>
      <span>${ticketNote}</span>
    </div>
  `;

  card.addEventListener("click", () => openModal(acct.id));
  return card;
}

function buildSkeletonCard(acct) {
  const card = document.createElement("div");
  card.className = "account-card skeleton";
  card.innerHTML = `
    <div class="card-header">
      <div style="flex:1">
        <div class="card-name" style="color:var(--text-3)">${esc(acct.name)}</div>
      </div>
      <span class="health-badge nodata" style="opacity:.5">—</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
      <div class="skeleton-line w-80"></div>
      <div class="skeleton-line w-60"></div>
    </div>
    <div class="card-footer">
      <span class="card-arr" style="opacity:.4">${fmtARR(acct.arr)}</span>
      <span style="color:var(--text-3);font-size:11px">Summary not generated yet</span>
    </div>
  `;
  return card;
}

// ── Modal ─────────────────────────────────────────────────────────────
function openModal(id) {
  const acct = DATA.accounts.find(a => a.id === id);
  if (!acct) return;

  // Header
  document.getElementById("modalAccountName").textContent = acct.name;
  document.getElementById("modalMeta").innerHTML = `
    <span>${esc(acct.sector)}</span>
    <span>${fmtARR(acct.arr)}/yr</span>
    <span>${acct.tenure} months tenure</span>
    <span>CSM: ${esc(acct.csm)}</span>
    <span class="health-badge ${acct.health}" style="font-size:10px">${HEALTH_LABEL[acct.health]}</span>
  `;

  // Body
  document.getElementById("modalBody").innerHTML = buildModalBody(acct);

  // Show
  document.getElementById("modalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function buildModalBody(acct) {
  const parts = [];

  // ── Summary ──
  parts.push(`
    <div class="detail-section">
      <div class="section-label">Weekly summary</div>
      <div class="summary-text">${esc(acct.summary.text)}</div>
    </div>
  `);

  // ── Sources ──
  parts.push(`<div class="detail-section">
    <div class="section-label">Sources — raw signals</div>
    <div class="sources-grid">
  `);

  // Support tickets
  parts.push(buildTicketSource(acct));

  // NPS
  parts.push(buildNPSSource(acct));

  // Usage (not for Goldwald)
  if (acct.id !== "goldwald-hotels") {
    parts.push(buildUsageSource(acct));
  }

  // Email
  if (acct.email) {
    parts.push(buildEmailSource(acct));
  }

  parts.push(`</div></div>`);

  return parts.join("\n");
}

function buildTicketSource(acct) {
  const tickets = acct.tickets || [];
  if (tickets.length === 0) {
    return `
      <div class="source-block">
        <div class="source-header"><span class="source-icon">🎫</span> Support tickets (last 7 days)</div>
        <div class="source-body"><div class="no-data-notice">No tickets this week</div></div>
      </div>`;
  }

  const rows = tickets.map(t => `
    <tr>
      <td><code style="font-size:11px;color:var(--text-3)">${esc(t.id)}</code></td>
      <td><span class="sev-badge ${t.severity}">${t.severity}</span></td>
      <td>
        <span class="status-dot ${t.status}"></span>
        <span style="color:var(--text-2)">${t.status}</span>
      </td>
      <td style="color:var(--text-1)">${esc(t.subject)}</td>
    </tr>
  `).join("");

  return `
    <div class="source-block">
      <div class="source-header"><span class="source-icon">🎫</span> Support tickets (last 7 days)</div>
      <div class="source-body" style="padding:0">
        <table class="tickets-table">
          <thead><tr><th>Ticket</th><th>Sev</th><th>Status</th><th>Subject</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function buildNPSSource(acct) {
  // Goldwald has no NPS this period
  if (acct.id === "goldwald-hotels") {
    const hist = acct.npsHistoric;
    return `
      <div class="source-block">
        <div class="source-header"><span class="source-icon">📊</span> NPS score</div>
        <div class="source-body">
          <div class="no-data-notice">
            No NPS response this period.<br>
            <span style="font-size:11px">Last response ${hist.date}: <strong>${hist.score}/10</strong> — "${esc(hist.comment)}"</span>
          </div>
        </div>
      </div>`;
  }

  if (!acct.nps) {
    return `
      <div class="source-block">
        <div class="source-header"><span class="source-icon">📊</span> NPS score</div>
        <div class="source-body"><div class="no-data-notice">No NPS data available</div></div>
      </div>`;
  }

  const { score, date, comment } = acct.nps;
  const cls = score >= 9 ? "high" : score >= 7 ? "medium" : "low";
  const commentHtml = comment
    ? `<div class="nps-comment">${esc(comment)}</div>`
    : `<div style="font-size:12px;color:var(--text-3);margin-top:6px">No comment</div>`;

  return `
    <div class="source-block">
      <div class="source-header"><span class="source-icon">📊</span> NPS score — most recent (within 90 days)</div>
      <div class="source-body">
        <div class="nps-row">
          <span class="nps-score ${cls}">${score}<span style="font-size:14px;font-weight:400;color:var(--text-3)">/10</span></span>
          <span class="nps-date">${date}</span>
        </div>
        ${commentHtml}
      </div>
    </div>`;
}

function buildUsageSource(acct) {
  const u = acct.usage;
  if (!u) {
    return `
      <div class="source-block">
        <div class="source-header"><span class="source-icon">📈</span> Usage snapshot (last 7 days)</div>
        <div class="source-body"><div class="no-data-notice">No usage data this week</div></div>
      </div>`;
  }

  const deltaHtml = u.chatAgentPriorWeek != null
    ? `<div class="usage-delta">↓ ${Math.round((1 - u.chatAgentSessions / u.chatAgentPriorWeek) * 100)}% vs prior week (${u.chatAgentPriorWeek})</div>`
    : "";

  return `
    <div class="source-block">
      <div class="source-header"><span class="source-icon">📈</span> Usage snapshot (last 7 days)</div>
      <div class="source-body">
        <div class="usage-grid">
          <div class="usage-item">
            <div class="usage-val">${u.csmLogins}</div>
            <div class="usage-lbl">CSM logins</div>
          </div>
          <div class="usage-item">
            <div class="usage-val">${u.customerLogins}</div>
            <div class="usage-lbl">Customer logins</div>
          </div>
          <div class="usage-item">
            <div class="usage-val">${u.activePostings}</div>
            <div class="usage-lbl">Active postings</div>
          </div>
          <div class="usage-item">
            <div class="usage-val">${u.chatAgentSessions}</div>
            <div class="usage-lbl">ChatAgent sessions</div>
            ${deltaHtml}
          </div>
        </div>
      </div>
    </div>`;
}

function buildEmailSource(acct) {
  const e = acct.email;
  const isChurn = acct.id === "goldwald-hotels";
  const churnAlert = isChurn
    ? `<div class="churn-alert">⚠ Churn-intent signal — customer has indicated cancellation intent</div>`
    : "";

  return `
    <div class="source-block">
      <div class="source-header"><span class="source-icon">✉️</span> Email excerpt</div>
      <div class="source-body">
        ${churnAlert}
        <div class="email-excerpt">
          <div class="email-from">From: ${esc(e.from)} · ${e.date}</div>
          ${esc(e.excerpt)}
        </div>
      </div>
    </div>`;
}

// ── History view ──────────────────────────────────────────────────────
function populateHistorySelect() {
  const sel = document.getElementById("accountSelect");
  const sorted = [...DATA.accounts].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach(acct => {
    const opt = document.createElement("option");
    opt.value = acct.id;
    opt.textContent = acct.name;
    sel.appendChild(opt);
  });
  // Default to first (alphabetical) — or pick an interesting one
  const defaultId = "albrecht-pflege";
  sel.value = defaultId;
}

function renderHistoryChart(accountId) {
  const acct = DATA.accounts.find(a => a.id === accountId);
  if (!acct) return;

  const ctx = document.getElementById("historyChart").getContext("2d");
  const h = acct.history;

  // Health score → label mapping for y-axis
  const healthMap = { 0: "No data", 1: "Red", 2: "Yellow", 3: "Green" };
  const healthColors = { 0: "#9ca3af", 1: "#ef4444", 2: "#eab308", 3: "#16a34a" };

  // Point colors per value
  const pointColors = h.healthScore.map(v => healthColors[v] || "#9ca3af");

  // Update titles
  document.getElementById("histChartTitle").textContent = acct.name + " — 8-week trend";
  document.getElementById("histChartSub").textContent =
    `${acct.sector} · ${fmtARR(acct.arr)}/yr · CSM ${acct.csm}`;

  if (historyChart) { historyChart.destroy(); historyChart = null; }

  historyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: h.weeks,
      datasets: [
        {
          label: "Health status",
          data: h.healthScore,
          yAxisID: "yHealth",
          borderColor: "#4a7fc1",
          backgroundColor: "rgba(74,127,193,.08)",
          borderWidth: 2,
          tension: 0.2,
          fill: true,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
        {
          label: "ChatAgent sessions",
          data: h.chatAgentSessions,
          yAxisID: "ySessions",
          borderColor: "#94a3b8",
          backgroundColor: "transparent",
          borderWidth: 2,
          borderDash: [4, 3],
          tension: 0.2,
          pointBackgroundColor: "#94a3b8",
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 0) {
                return " Health: " + (healthMap[ctx.raw] || ctx.raw);
              }
              return " ChatAgent sessions: " + ctx.raw;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "#f3f4f6" },
          ticks: { font: { size: 12 }, color: "#6b7280" }
        },
        yHealth: {
          position: "left",
          min: 0, max: 3,
          ticks: {
            stepSize: 1,
            font: { size: 11 },
            color: "#6b7280",
            callback: v => healthMap[v] || ""
          },
          grid: { color: "#f3f4f6" },
          title: { display: true, text: "Health", font: { size: 11 }, color: "#9ca3af" }
        },
        ySessions: {
          position: "right",
          min: 0,
          ticks: { font: { size: 11 }, color: "#9ca3af" },
          grid: { display: false },
          title: { display: true, text: "ChatAgent sessions", font: { size: 11 }, color: "#9ca3af" }
        }
      }
    }
  });
}

// ── System health ─────────────────────────────────────────────────────
function renderSysHealth() {
  const tbody = document.getElementById("sysHealthBody");
  if (tbody.dataset.rendered) return;
  tbody.dataset.rendered = "1";

  tbody.innerHTML = DATA.systemHealth.map(src => {
    const statusLabel = { ok: "Connected", degraded: "Degraded", error: "Error" }[src.status] || src.status;
    const noteHtml = src.note
      ? `<div class="degraded-note">⚠ ${esc(src.note)}</div>`
      : "";
    return `
      <tr>
        <td>${esc(src.name)}</td>
        <td>
          <div class="status-indicator">
            <div class="dot ${src.status}"></div>
            <span class="status-text ${src.status}">${statusLabel}</span>
          </div>
          ${noteHtml}
        </td>
        <td><span class="sync-time">${esc(src.lastSync)}</span></td>
      </tr>`;
  }).join("");
}

// ── Utilities ─────────────────────────────────────────────────────────
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtARR(n) {
  return "€" + Number(n).toLocaleString("de-DE");
}
