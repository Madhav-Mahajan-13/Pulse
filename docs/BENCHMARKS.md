# Benchmarks

Benchmarks are executable release gates, not marketing claims. Results depend on hardware, operating system, runtime version, and background load, so every run prints its environment alongside measurements.

## Middleware overhead

Run:

```powershell
npm.cmd run benchmark:overhead
```

The harness starts two localhost Express servers: one baseline and one using NodePulse. After warm-up, it runs three alternating rounds, calculates p95 end-to-end request latency for each server, and uses the median p95 difference as middleware overhead. The gate requires overhead below 1 ms.

Local result on 2026-08-30:

- Node.js: 22.14.0
- CPU: AMD Ryzen 7 5800H, 16 logical processors
- Requests: 4,000 per server per round, concurrency 32
- Measured median p95 overhead: 0.491 ms
- Result: pass

The GitHub Actions result is the release reference because shared-runner hardware is documented by the workflow run itself.

## Bounded memory

Quick profile:

```powershell
npm.cmd run benchmark:memory
```

Full release profile:

```powershell
npm.cmd run benchmark:memory:release
```

The simulation sends 500 metric events per second across 50 routes while advancing a deterministic clock. Explicit garbage collection is performed before each minute sample. The release profile simulates 120 minutes with a 60-minute retention window, or 3.6 million requests, and requires the retained heap to plateau after minute 60.

Local release result on 2026-08-30:

- Simulated requests: 3,600,000
- Retained routes: 50
- Heap at retention fill: 7,918,264 bytes
- Peak heap after retention fill: 8,014,400 bytes
- Post-fill growth: 96,136 bytes
- Allowed post-fill growth: 10,485,760 bytes
- Result: pass

## Browser verification

Run:

```powershell
npm.cmd run test:browser
```

Playwright starts the built example application and verifies the dashboard in real Chromium at desktop and mobile viewport sizes. The checks cover live route rendering, polling completion, accessible roles, sparklines, absence of browser errors, and absence of external asset requests.
