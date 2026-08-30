interface DashboardOptions {
  readonly metricsJsonPath: string;
  readonly defaultWindowSeconds: number;
  readonly refreshIntervalMs?: number;
}

export function renderDashboard(options: DashboardOptions): string {
  const clientConfig = safeInlineJson({
    metricsJsonPath: options.metricsJsonPath,
    windowSeconds: options.defaultWindowSeconds,
    refreshIntervalMs: options.refreshIntervalMs ?? 5_000,
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NodePulse APM</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0b0b0d;
      color: #f4f3ee;
      --ink: #f4f3ee;
      --muted: #929198;
      --line: #29292e;
      --surface: #141417;
      --surface-raised: #1a1a1e;
      --lime: #c7ff4a;
      --violet: #a78bfa;
      --coral: #ff6b6b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 8% 0%, rgb(199 255 74 / 8%), transparent 24rem),
        radial-gradient(circle at 95% 12%, rgb(167 139 250 / 8%), transparent 28rem),
        #0b0b0d;
    }
    body::before {
      position: fixed;
      inset: 0;
      z-index: -1;
      background-image: linear-gradient(rgb(255 255 255 / 2%) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 2%) 1px, transparent 1px);
      background-size: 40px 40px;
      content: "";
      mask-image: linear-gradient(to bottom, black, transparent 65%);
    }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 64px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 58px; }
    .brand { display: flex; align-items: center; gap: 10px; font-size: .8rem; font-weight: 800; letter-spacing: -.01em; }
    .brand-mark { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 8px; background: var(--lime); color: #0b0b0d; }
    .brand-mark svg { width: 17px; height: 17px; }
    #status { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: .78rem; font-variant-numeric: tabular-nums; }
    #status::before { width: 7px; height: 7px; border-radius: 50%; background: var(--lime); box-shadow: 0 0 0 4px rgb(199 255 74 / 10%); content: ""; }
    #status[data-state="loading"]::before { animation: pulse 1.4s ease-in-out infinite; }
    #status[data-state="error"] { color: #ffaaa7; }
    #status[data-state="error"]::before { background: var(--coral); box-shadow: 0 0 0 4px rgb(255 107 107 / 10%); }
    header { display: flex; justify-content: space-between; align-items: end; gap: 32px; margin-bottom: 30px; }
    h1 { max-width: 720px; margin: 0; font-size: clamp(2.65rem, 7vw, 5.5rem); font-weight: 760; letter-spacing: -.075em; line-height: .9; }
    h1 span { color: var(--lime); }
    .eyebrow { margin: 0 0 15px; color: var(--violet); font-size: .7rem; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    .subtitle { max-width: 260px; margin: 0; color: var(--muted); font-size: .9rem; line-height: 1.55; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    .card, .panel { border: 1px solid var(--line); background: rgb(20 20 23 / 90%); }
    .card { position: relative; min-height: 145px; overflow: hidden; padding: 20px; border-radius: 18px; }
    .card::after { position: absolute; right: -18px; bottom: -28px; width: 90px; height: 90px; border: 18px solid rgb(255 255 255 / 3%); border-radius: 50%; content: ""; }
    .card:nth-child(2) { background: var(--lime); color: #101105; border-color: var(--lime); }
    .card:nth-child(2) .label, .card:nth-child(2) .card-note { color: rgb(16 17 5 / 62%); }
    .label { color: var(--muted); font-size: .68rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .value { display: block; margin-top: 16px; font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 760; letter-spacing: -.06em; line-height: 1; font-variant-numeric: tabular-nums; }
    .card-note { position: absolute; bottom: 18px; left: 20px; color: #6f6e75; font-size: .68rem; }
    .panel { overflow: hidden; border-radius: 18px; }
    .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 21px 22px; border-bottom: 1px solid var(--line); }
    .panel-title { display: flex; align-items: center; gap: 9px; }
    .panel-title::before { width: 8px; height: 8px; border-radius: 2px; background: var(--violet); content: ""; transform: rotate(12deg); }
    h2 { margin: 0; font-size: .92rem; letter-spacing: -.02em; }
    #window-label { color: var(--muted); font-size: .72rem; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 15px 18px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
    th { color: #706f76; font-size: .64rem; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
    th:first-child, td:first-child { text-align: left; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr { transition: background-color 140ms ease; }
    tbody tr:hover { background: rgb(255 255 255 / 2.5%); }
    code { color: var(--ink); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .78rem; }
    .route { display: flex; align-items: center; gap: 10px; }
    .method { min-width: 43px; padding: 4px 6px; border-radius: 6px; background: rgb(167 139 250 / 12%); color: #c4b5fd; font: 800 .59rem/1 ui-monospace, monospace; letter-spacing: .04em; text-align: center; }
    .method[data-method="GET"] { background: rgb(199 255 74 / 11%); color: var(--lime); }
    .method[data-method="POST"] { background: rgb(96 165 250 / 12%); color: #93c5fd; }
    .method[data-method="DELETE"] { background: rgb(255 107 107 / 12%); color: #ffaaa7; }
    .latency { display: inline-flex; align-items: center; justify-content: flex-end; gap: 9px; }
    .latency-bar { width: 34px; height: 3px; overflow: hidden; border-radius: 9px; background: #2c2c31; }
    .latency-fill { display: block; height: 100%; border-radius: inherit; background: var(--violet); }
    .sparkline { display: block; width: 92px; height: 28px; overflow: visible; }
    .empty { padding: 56px 20px; color: var(--muted); font-size: .85rem; text-align: center; }
    .error-rate[data-alert="true"] { color: #ff8e89; font-weight: 750; }
    @keyframes pulse { 50% { opacity: .35; transform: scale(.75); } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
    @media (max-width: 720px) {
      main { padding-top: 22px; }
      .topbar { margin-bottom: 42px; }
      header { align-items: start; flex-direction: column; gap: 16px; }
      .subtitle { max-width: 100%; }
      .summary { grid-template-columns: 1fr 1fr; }
      .card { min-height: 120px; }
      .card:first-child { grid-column: 1 / -1; }
      .value { margin-top: 12px; }
      .card-note { display: none; }
      th, td { padding: 14px 15px; }
    }
    @media (max-width: 430px) {
      h1 { font-size: 3rem; }
      .summary { gap: 8px; }
      .card { padding: 16px; border-radius: 15px; }
      .panel { border-radius: 15px; }
      .panel-header { padding: 18px 16px; }
    }
  </style>
</head>
<body>
  <main>
    <div class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M2 10h3l2-5 4 10 2-5h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>nodepulse</div>
      <div id="status" data-state="loading" aria-live="polite">Connecting…</div>
    </div>
    <header>
      <div><p class="eyebrow">Live application health</p><h1>NodePulse <span>APM.</span></h1></div>
      <p class="subtitle">A quiet little window into your Express app. Private, local, and always live.</p>
    </header>
    <section class="summary" aria-label="Summary">
      <article class="card"><span class="label">Tracked routes</span><strong class="value" id="route-count">—</strong><span class="card-note">active in this window</span></article>
      <article class="card"><span class="label">Total requests</span><strong class="value" id="request-count">—</strong><span class="card-note">matched traffic</span></article>
      <article class="card"><span class="label">Unmatched</span><strong class="value" id="unmatched-count">—</strong><span class="card-note">404s and unknown routes</span></article>
    </section>
    <section class="panel">
      <div class="panel-header"><div class="panel-title"><h2>Route performance</h2></div><span id="window-label"></span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Route</th><th>RPS</th><th>Average</th><th>p95</th><th>Errors</th><th>Recent trend</th></tr></thead>
          <tbody id="routes"></tbody>
        </table>
        <div class="empty" id="empty" hidden>No completed application requests in this window.</div>
      </div>
    </section>
  </main>
  <script>
    "use strict";
    const config = ${clientConfig};
    const byId = (id) => document.getElementById(id);
    const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

    function textCell(value, className) {
      const cell = document.createElement("td");
      if (className) cell.className = className;
      cell.textContent = value;
      return cell;
    }

    function sparkline(values) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "sparkline");
      svg.setAttribute("viewBox", "0 0 100 28");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Recent request trend");
      const maximum = Math.max(1, ...values);
      const denominator = Math.max(1, values.length - 1);
      const points = values.map((value, index) => (index / denominator * 100) + "," + (26 - value / maximum * 24)).join(" ");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", points);
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "#c7ff4a");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("vector-effect", "non-scaling-stroke");
      svg.append(line);
      return svg;
    }

    function render(payload) {
      byId("route-count").textContent = number.format(payload.routes.length);
      byId("request-count").textContent = number.format(payload.routes.reduce((sum, route) => sum + route.requestCount, 0));
      byId("unmatched-count").textContent = number.format(payload.unmatched.requestCount);
      byId("window-label").textContent = "Rolling " + number.format(payload.windowSeconds / 60) + " min window";
      const body = byId("routes");
      body.replaceChildren();
      byId("empty").hidden = payload.routes.length !== 0;

      for (const route of payload.routes) {
        const row = document.createElement("tr");
        const routeCell = document.createElement("td");
        const routeWrap = document.createElement("div");
        routeWrap.className = "route";
        const firstSpace = route.routeKey.indexOf(" ");
        const method = firstSpace < 0 ? "" : route.routeKey.slice(0, firstSpace);
        const path = firstSpace < 0 ? route.routeKey : route.routeKey.slice(firstSpace + 1);
        const methodBadge = document.createElement("span");
        methodBadge.className = "method";
        methodBadge.dataset.method = method;
        methodBadge.textContent = method;
        const code = document.createElement("code");
        code.textContent = path;
        routeWrap.append(methodBadge, code);
        routeCell.append(routeWrap);
        row.append(routeCell);
        row.append(textCell(number.format(route.requestsPerSecond)));
        row.append(textCell(route.averageResponseTimeMs === null ? "—" : number.format(route.averageResponseTimeMs) + " ms"));
        const latencyCell = document.createElement("td");
        if (route.p95ResponseTimeMs === null) {
          latencyCell.textContent = "—";
        } else {
          const latency = document.createElement("span");
          latency.className = "latency";
          const latencyValue = document.createElement("span");
          latencyValue.textContent = number.format(route.p95ResponseTimeMs) + " ms";
          const latencyBar = document.createElement("span");
          latencyBar.className = "latency-bar";
          const latencyFill = document.createElement("span");
          latencyFill.className = "latency-fill";
          latencyFill.style.width = Math.min(100, Math.max(4, route.p95ResponseTimeMs / 10)) + "%";
          latencyBar.append(latencyFill);
          latency.append(latencyBar, latencyValue);
          latencyCell.append(latency);
        }
        row.append(latencyCell);
        const errorCell = textCell(number.format(route.errorRate * 100) + "%", "error-rate");
        errorCell.dataset.alert = String(route.errorRate > 0);
        row.append(errorCell);
        const trendCell = document.createElement("td");
        trendCell.append(sparkline(route.recentRequestCounts));
        row.append(trendCell);
        body.append(row);
      }

      byId("status").dataset.state = "ok";
      byId("status").textContent = "Updated " + new Date(payload.generatedAtMs).toLocaleTimeString();
    }

    async function refresh() {
      try {
        const response = await fetch(config.metricsJsonPath + "?windowSeconds=" + config.windowSeconds, { cache: "no-store" });
        if (!response.ok) throw new Error("Metrics request failed: " + response.status);
        render(await response.json());
      } catch (error) {
        byId("status").dataset.state = "error";
        byId("status").textContent = error instanceof Error ? error.message : "Unable to load metrics";
      }
    }

    void refresh();
    setInterval(() => void refresh(), config.refreshIntervalMs);
  </script>
</body>
</html>`;
}

function safeInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
