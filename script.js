/* ── Customer Health Dashboard · script.js ─────────────────────────── */

let DATA = null;
let portfolioChart = null;
let historyChart = null;
let fridayMode = false;

const HEALTH_ORDER  = { Red: 0, nodata: 1, Yellow: 2, Green: 3 };
const HEALTH_LABEL  = { Green: "Green", Yellow: "Yellow", Red: "Red", nodata: "No data" };
const HEALTH_COLOR  = { Green: "#22c55e", Yellow: "#f59e0b", Red: "#ef4444", nodata: "#cbd5e1" };

/* ── Boot ──────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("data.json");
    DATA = await res.json();
    init();
  } catch (e) {
    document.body.innerHTML = `
      <div style="padding:40px;font-family:system-ui;color:#dc2626;max-width:600px">
        <strong>Could not load data.json.</strong><br>
        Serve this over HTTP, not file://. Run: <code>python3 -m http.server 8000</code><br><br>
        <code>${e.message}</code>
      </div>`;
  }
});

function init() {
  // Sidebar nav
  document.querySelectorAll(".snav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // Friday toggle
  document.getElementById("toggleBefore").addEventListener("click", () => setFridayMode(false));
  document.getElementById("toggleFriday").addEventListener("click",  () => setFridayMode(true));

  // Modal
  document.getElementById("modalOverlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  // Mobile sidebar
  document.getElementById("mobileMenuBtn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebarOverlay").classList.add("open");
  });
  document.getElementById("sidebarOverlay").addEventListener("click", closeSidebar);

  // Account selector (analytics)
  document.getElementById("accountSelect").addEventListener("change", e => {
    if (e.target.value) renderHistoryChart(e.target.value);
  });

  populateAccountSelect();
  renderStatsBar();
  renderAccountGrid();
}

/* ── View switching ────────────────────────────────────────────────── */
const VIEW_TITLES = {
  overview:    "Overview",
  analytics:   "Analytics",
  connections: "Connections"
};

function switchView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".snav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("view-" + viewId).classList.add("active");
  document.querySelector(`.snav-btn[data-view="${viewId}"]`).classList.add("active");
  document.getElementById("topbarTitle").textContent = VIEW_TITLES[viewId] || viewId;
  closeSidebar();

  if (viewId === "analytics")   { renderPortfolioChart(); }
  if (viewId === "connections") { renderConnections(); }
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}

/* ── Friday toggle ─────────────────────────────────────────────────── */
function setFridayMode(on) {
  fridayMode = on;
  document.getElementById("toggleBefore").classList.toggle("selected", !on);
  document.getElementById("toggleFriday").classList.toggle("selected",  on);
  document.getElementById("toggleHint").textContent = on
    ? "All 20 accounts — click any card for the full source breakdown."
    : "Data not yet generated — switch to Friday to see account summaries.";
  renderAccountGrid();
}

/* ── Stats bar ─────────────────────────────────────────────────────── */
function renderStatsBar() {
  const c = { Green: 0, Yellow: 0, Red: 0, nodata: 0 };
  DATA.accounts.forEach(a => c[a.health]++);
  document.getElementById("countGreen").textContent  = c.Green;
  document.getElementById("countYellow").textContent = c.Yellow;
  document.getElementById("countRed").textContent    = c.Red;
  document.getElementById("countNodata").textContent = c.nodata;
}

/* ── Account grid ──────────────────────────────────────────────────── */
function renderAccountGrid() {
  const grid = document.getElementById("accountsGrid");
  grid.innerHTML = "";
  const sorted = [...DATA.accounts].sort(
    (a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]
  );
  sorted.forEach(acct => {
    grid.appendChild(fridayMode ? buildCard(acct) : buildSkeletonCard(acct));
  });
}

/* Full card with summary preview */
function buildCard(acct) {
  const card = document.createElement("div");
  card.className = `account-card health-${acct.health}`;

  const openTickets = (acct.tickets || []).filter(t => t.status === "Open").length;
  const totalTickets = (acct.tickets || []).length;

  let ticketHtml;
  if (openTickets > 0) {
    ticketHtml = `<span class="card-ticket-open">🎫 ${openTickets} open</span>`;
  } else if (totalTickets > 0) {
    ticketHtml = `<span class="card-ticket-none">🎫 ${totalTickets} resolved</span>`;
  } else {
    ticketHtml = `<span class="card-ticket-none">No tickets</span>`;
  }

  const npsHtml = acct.nps
    ? `<span class="card-nps">NPS ${acct.nps.score}/10</span>`
    : (acct.id === "goldwald-hotels" ? `<span class="card-nps" style="color:var(--red)">⚠ Churn signal</span>` : ``);

  card.innerHTML = `
    <div class="card-strip"></div>
    <div class="card-body">
      <div class="card-top">
        <div class="card-name">${esc(acct.name)}</div>
        <span class="health-badge ${acct.health}">${HEALTH_LABEL[acct.health]}</span>
      </div>
      <div class="card-meta-line">${esc(acct.sector)} · ${esc(acct.csm)} · ${fmtARRShort(acct.arr)}</div>
      <div class="card-summary">${esc(acct.summary.text)}</div>
      <div class="card-footer">
        <span class="card-arr">${fmtARR(acct.arr)}</span>
        <span class="card-signals">
          ${ticketHtml}
          ${npsHtml}
          <span class="card-cta">Details →</span>
        </span>
      </div>
    </div>
  `;

  card.addEventListener("click", () => openModal(acct.id));
  return card;
}

/* Skeleton card for Before-Friday state */
function buildSkeletonCard(acct) {
  const card = document.createElement("div");
  card.className = `account-card skeleton health-${acct.health}`;
  card.innerHTML = `
    <div class="card-strip" style="opacity:.3"></div>
    <div class="card-body">
      <div class="card-top">
        <div class="card-name" style="color:var(--text-3)">${esc(acct.name)}</div>
        <span class="health-badge nodata" style="opacity:.4">—</span>
      </div>
      <div class="card-meta-line" style="opacity:.4">${esc(acct.sector)} · ${esc(acct.csm)}</div>
      <div class="skeleton-summary" style="margin:10px 0"></div>
      <div class="card-footer">
        <span class="card-arr" style="opacity:.3">${fmtARR(acct.arr)}</span>
        <span class="skeleton-not-ready">Summary not generated yet</span>
      </div>
    </div>
  `;
  return card;
}

/* ── Modal ─────────────────────────────────────────────────────────── */
function openModal(id) {
  const acct = DATA.accounts.find(a => a.id === id);
  if (!acct) return;

  document.getElementById("modalAccountName").textContent = acct.name;
  document.getElementById("modalMeta").innerHTML = `
    <span>${esc(acct.sector)}</span>
    <span class="modal-meta-sep">·</span>
    <span>${fmtARR(acct.arr)}/yr</span>
    <span class="modal-meta-sep">·</span>
    <span>${acct.tenure} months</span>
    <span class="modal-meta-sep">·</span>
    <span>CSM: ${esc(acct.csm)}</span>
    <span class="modal-meta-sep">·</span>
    <span class="health-badge ${acct.health}" style="font-size:9.5px">${HEALTH_LABEL[acct.health]}</span>
  `;
  document.getElementById("modalBody").innerHTML = buildModalBody(acct);
  document.getElementById("modalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function buildModalBody(acct) {
  const parts = [];

  // Summary
  parts.push(`
    <div>
      <div class="section-label">Weekly summary</div>
      <div class="summary-text">${esc(acct.summary.text)}</div>
    </div>
  `);

  // Sources
  parts.push(`<div><div class="section-label">Sources — raw signals</div><div class="sources-grid">`);
  parts.push(buildTicketSource(acct));
  parts.push(buildNPSSource(acct));
  if (acct.id !== "goldwald-hotels") parts.push(buildUsageSource(acct));
  if (acct.email) parts.push(buildEmailSource(acct));
  parts.push(`</div></div>`);

  return parts.join("");
}

function buildTicketSource(acct) {
  const tickets = acct.tickets || [];
  if (!tickets.length) {
    return `<div class="source-block">
      <div class="source-header"><span>🎫</span> Support tickets — last 7 days</div>
      <div class="source-body"><div class="no-data-notice">No tickets this week</div></div>
    </div>`;
  }
  const rows = tickets.map(t => `
    <tr>
      <td><code style="font-size:10.5px;color:var(--text-3)">${esc(t.id)}</code></td>
      <td><span class="sev-badge ${t.severity}">${t.severity}</span></td>
      <td>
        <span class="status-dot-sm ${t.status}"></span>
        <span style="color:var(--text-2);font-size:12px">${t.status}</span>
      </td>
      <td>${esc(t.subject)}</td>
    </tr>`).join("");
  return `<div class="source-block">
    <div class="source-header"><span>🎫</span> Support tickets — last 7 days</div>
    <div class="source-body" style="padding:0">
      <table class="tickets-table">
        <thead><tr><th>Ticket</th><th>Sev</th><th>Status</th><th>Subject</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function buildNPSSource(acct) {
  if (acct.id === "goldwald-hotels") {
    const h = acct.npsHistoric;
    return `<div class="source-block">
      <div class="source-header"><span>📊</span> NPS score</div>
      <div class="source-body">
        <div class="no-data-notice">
          No response this period.<br>
          <span style="font-size:11.5px">Last response ${h.date}: <strong>${h.score}/10</strong> — "${esc(h.comment)}"</span>
        </div>
      </div>
    </div>`;
  }
  if (!acct.nps) return `<div class="source-block">
    <div class="source-header"><span>📊</span> NPS score</div>
    <div class="source-body"><div class="no-data-notice">No NPS data available</div></div>
  </div>`;

  const { score, date, comment } = acct.nps;
  const cls = score >= 9 ? "high" : score >= 7 ? "medium" : "low";
  return `<div class="source-block">
    <div class="source-header"><span>📊</span> NPS — most recent (within 90 days)</div>
    <div class="source-body">
      <div class="nps-row">
        <span class="nps-score ${cls}">${score}<span class="nps-denom">/10</span></span>
        <span class="nps-date">${date}</span>
      </div>
      ${comment
        ? `<div class="nps-comment">${esc(comment)}</div>`
        : `<div style="font-size:12px;color:var(--text-3);margin-top:6px">No comment</div>`}
    </div>
  </div>`;
}

function buildUsageSource(acct) {
  const u = acct.usage;
  if (!u) return `<div class="source-block">
    <div class="source-header"><span>📈</span> Usage snapshot — last 7 days</div>
    <div class="source-body"><div class="no-data-notice">No usage data</div></div>
  </div>`;

  const deltaHtml = u.chatAgentPriorWeek != null
    ? `<div class="usage-delta">↓ ${Math.round((1 - u.chatAgentSessions / u.chatAgentPriorWeek) * 100)}% vs prior week (${u.chatAgentPriorWeek})</div>`
    : "";

  return `<div class="source-block">
    <div class="source-header"><span>📈</span> Usage snapshot — last 7 days</div>
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
  const churn = acct.id === "goldwald-hotels"
    ? `<div class="churn-alert">⚠ Churn-intent signal — customer indicated cancellation</div>`
    : "";
  return `<div class="source-block">
    <div class="source-header"><span>✉️</span> Email excerpt</div>
    <div class="source-body">
      ${churn}
      <div class="email-excerpt">
        <div class="email-from">From: ${esc(e.from)} · ${e.date}</div>
        ${esc(e.excerpt)}
      </div>
    </div>
  </div>`;
}

/* ── Analytics: Portfolio trend chart ─────────────────────────────── */
let portfolioRendered = false;

function renderPortfolioChart() {
  if (portfolioRendered) return;
  portfolioRendered = true;

  const weeks = DATA.accounts[0].history.weeks;
  const counts = weeks.map(() => ({ Green: 0, Yellow: 0, Red: 0, NoData: 0 }));

  DATA.accounts.forEach(acct => {
    acct.history.healthScore.forEach((score, wi) => {
      if      (score === 3) counts[wi].Green++;
      else if (score === 2) counts[wi].Yellow++;
      else if (score === 1) counts[wi].Red++;
      else                  counts[wi].NoData++;
    });
  });

  const ctx = document.getElementById("portfolioChart").getContext("2d");
  portfolioChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: weeks,
      datasets: [
        {
          label: "Green",
          data: counts.map(c => c.Green),
          backgroundColor: "rgba(34,197,94,.85)",
          borderWidth: 0,
        },
        {
          label: "Yellow",
          data: counts.map(c => c.Yellow),
          backgroundColor: "rgba(245,158,11,.85)",
          borderWidth: 0,
        },
        {
          label: "Red",
          data: counts.map(c => c.Red),
          backgroundColor: "rgba(239,68,68,.85)",
          borderWidth: 0,
        },
        {
          label: "No data",
          data: counts.map(c => c.NoData),
          backgroundColor: "rgba(203,213,225,.9)",
          borderWidth: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ([ctx]) => "Week " + ctx.label,
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} account${ctx.raw !== 1 ? "s" : ""}`
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 12 }, color: "#94a3b8" }
        },
        y: {
          stacked: true,
          min: 0,
          max: 20,
          ticks: { stepSize: 5, font: { size: 12 }, color: "#94a3b8" },
          grid: { color: "#f0f2f5" }
        }
      }
    }
  });
}

/* ── Analytics: Individual account chart ──────────────────────────── */
function populateAccountSelect() {
  const sel = document.getElementById("accountSelect");
  const sorted = [...DATA.accounts].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach(acct => {
    const opt = document.createElement("option");
    opt.value = acct.id;
    opt.textContent = acct.name;
    sel.appendChild(opt);
  });
  sel.value = "albrecht-pflege"; // default: most interesting case
  // pre-render so chart shows immediately when Analytics tab is first opened
  renderHistoryChart("albrecht-pflege");
}

function renderHistoryChart(accountId) {
  const acct = DATA.accounts.find(a => a.id === accountId);
  if (!acct) return;

  document.getElementById("histChartTitle").textContent = acct.name + " — 8-week trend";
  document.getElementById("histChartSub").textContent =
    `${acct.sector} · ${fmtARR(acct.arr)}/yr · CSM ${acct.csm}`;

  const h = acct.history;
  const healthColors = { 0: "#94a3b8", 1: "#ef4444", 2: "#f59e0b", 3: "#22c55e" };
  const pointBg = h.healthScore.map(v => healthColors[v] || "#94a3b8");
  const healthMap = { 0: "No data", 1: "Red", 2: "Yellow", 3: "Green" };

  const ctx = document.getElementById("historyChart").getContext("2d");
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
          borderColor: "#3b6fd4",
          backgroundColor: "rgba(59,111,212,.06)",
          borderWidth: 2.5,
          tension: 0.25,
          fill: true,
          pointBackgroundColor: pointBg,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
        {
          label: "ChatAgent sessions",
          data: h.chatAgentSessions,
          yAxisID: "ySessions",
          borderColor: "#94a3b8",
          backgroundColor: "transparent",
          borderWidth: 2,
          borderDash: [5, 4],
          tension: 0.25,
          pointBackgroundColor: "#94a3b8",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
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
          backgroundColor: "#fff",
          borderColor: "#e4e8ee",
          borderWidth: 1,
          titleColor: "#0f172a",
          bodyColor: "#4b5563",
          padding: 10,
          callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? ` Health: ${healthMap[ctx.raw] || ctx.raw}`
              : ` ChatAgent sessions: ${ctx.raw}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: "#f0f2f5" },
          ticks: { font: { size: 12 }, color: "#94a3b8" }
        },
        yHealth: {
          position: "left",
          min: 0, max: 3,
          ticks: {
            stepSize: 1,
            font: { size: 11 },
            color: "#94a3b8",
            callback: v => healthMap[v] || ""
          },
          grid: { color: "#f0f2f5" },
          title: { display: true, text: "Health", font: { size: 11 }, color: "#94a3b8" }
        },
        ySessions: {
          position: "right",
          min: 0,
          ticks: { font: { size: 11 }, color: "#94a3b8" },
          grid: { display: false },
          title: { display: true, text: "Sessions", font: { size: 11 }, color: "#94a3b8" }
        }
      }
    }
  });
}

/* ── Connections view ──────────────────────────────────────────────── */
let connectionsRendered = false;

const CONN_ICONS = {
  "Analytics / usage dashboard": "📊",
  "Ticketing system":             "🎫",
  "NPS survey tool":              "⭐",
  "Email / CRM inbox":            "✉️",
  "n8n orchestration workflow":   "⚙️"
};

function renderConnections() {
  if (connectionsRendered) return;
  connectionsRendered = true;

  const list = document.getElementById("connectionsList");
  list.innerHTML = DATA.systemHealth.map(src => {
    const icon = CONN_ICONS[src.name] || "🔌";
    const isOk = src.status === "ok";
    const badgeLabel = isOk ? "Connected" : "Degraded";
    const noteHtml = src.note
      ? `<div class="conn-note degraded">⚠ ${esc(src.note)}</div>`
      : `<div class="conn-note">Sync running normally</div>`;

    return `
      <div class="conn-card">
        <div class="conn-icon">${icon}</div>
        <div class="conn-info">
          <div class="conn-name">${esc(src.name)}</div>
          ${noteHtml}
        </div>
        <div class="conn-status">
          <div class="conn-badge ${src.status}">
            <span class="conn-badge-dot"></span>
            ${badgeLabel}
          </div>
          <div class="conn-sync">Last sync: ${esc(src.lastSync)}</div>
        </div>
      </div>`;
  }).join("");
}

/* ── Utilities ─────────────────────────────────────────────────────── */
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtARR(n) {
  return "€" + Number(n).toLocaleString("de-DE");
}

function fmtARRShort(n) {
  return "€" + (n >= 1000 ? (n / 1000).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + "k" : n);
}
