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
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #07111f; color: #e5edf7; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at top left, #123052 0, transparent 35%), #07111f; }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 36px 0 64px; }
    header { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -0.04em; }
    .eyebrow { margin: 0 0 8px; color: #67e8f9; font-size: .75rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .subtitle, #status { color: #9fb0c5; }
    #status[data-state="error"] { color: #fda4af; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
    .card, .panel { border: 1px solid #20344d; border-radius: 16px; background: rgb(11 25 43 / 88%); box-shadow: 0 16px 45px rgb(0 0 0 / 18%); }
    .card { padding: 18px; }
    .label { color: #8ea2b8; font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .value { display: block; margin-top: 8px; font-size: 1.7rem; font-weight: 750; }
    .panel { overflow: hidden; }
    .panel-header { display: flex; justify-content: space-between; gap: 16px; padding: 18px 20px; border-bottom: 1px solid #20344d; }
    h2 { margin: 0; font-size: 1rem; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 14px 16px; border-bottom: 1px solid #182b42; text-align: right; white-space: nowrap; }
    th { color: #8296ad; font-size: .72rem; letter-spacing: .06em; text-transform: uppercase; }
    th:first-child, td:first-child { text-align: left; }
    tbody tr:last-child td { border-bottom: 0; }
    code { color: #d8f7ff; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    .sparkline { width: 100px; height: 28px; }
    .empty { padding: 42px 20px; color: #8ea2b8; text-align: center; }
    .error-rate[data-alert="true"] { color: #fb7185; font-weight: 700; }
    @media (max-width: 720px) { header { align-items: start; flex-direction: column; } .summary { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div><p class="eyebrow">Live application health</p><h1>NodePulse APM</h1><p class="subtitle">Private, in-process Express metrics</p></div>
      <div id="status" aria-live="polite">Loading metrics…</div>
    </header>
    <section class="summary" aria-label="Summary">
      <article class="card"><span class="label">Tracked routes</span><strong class="value" id="route-count">—</strong></article>
      <article class="card"><span class="label">Total requests</span><strong class="value" id="request-count">—</strong></article>
      <article class="card"><span class="label">Unmatched</span><strong class="value" id="unmatched-count">—</strong></article>
    </section>
    <section class="panel">
      <div class="panel-header"><h2>Route performance</h2><span class="subtitle" id="window-label"></span></div>
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
      line.setAttribute("stroke", "#22d3ee");
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
        const code = document.createElement("code");
        code.textContent = route.routeKey;
        routeCell.append(code);
        row.append(routeCell);
        row.append(textCell(number.format(route.requestsPerSecond)));
        row.append(textCell(route.averageResponseTimeMs === null ? "—" : number.format(route.averageResponseTimeMs) + " ms"));
        row.append(textCell(route.p95ResponseTimeMs === null ? "—" : number.format(route.p95ResponseTimeMs) + " ms"));
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
