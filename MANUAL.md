# NodePulse APM Manual

This manual explains NodePulse in plain language. It covers how to install it, what happens to each request, how metrics are stored and calculated, how the dashboard and JSON endpoint work, and what every important repository file does.

## 1. What NodePulse is

NodePulse is a small monitoring library for Express applications. It runs inside the same Node.js process as the application.

It answers questions such as:

- Which routes receive traffic?
- How many requests arrive per minute?
- How long do responses take?
- What are the p50, p95, and p99 response times?
- Which routes return errors?
- How is traffic changing over time?

NodePulse has one public API:

```js
app.use(nodepulse(options));
```

It does not require an agent process, database, cloud account, or external monitoring server.

## 2. Quick start

### Install a local package build

Build and pack NodePulse from this repository:

```powershell
cd "..\Pulse"
npm.cmd run build
npm.cmd pack --pack-destination artifacts
```

Install the resulting package inside another Express project:

```powershell
npm.cmd install --force "..\Pulse\artifacts\madhavmahajan132-nodepulse-1.0.0.tgz"
```

### Add it to an Express application

CommonJS:

```js
const express = require("express");
const nodepulse = require("@madhavmahajan132/nodepulse");

const app = express();

app.use(nodepulse());

app.get("/health", (request, response) => {
  response.json({ status: "ok" });
});
```

ES modules:

```js
import express from "express";
import nodepulse from "@madhavmahajan132/nodepulse";

const app = express();
app.use(nodepulse());
```

Mount NodePulse before the application routes so it can observe their completed responses:

```text
Express application
│
├── NodePulse middleware       ← mount here
├── CORS / body parsing
├── request logger
├── application routes
├── not-found middleware
└── error handler
```

After starting the application, open:

```text
Dashboard:    http://localhost:<port>/nodepulse
JSON metrics: http://localhost:<port>/nodepulse/metrics.json
```

> The dashboard and JSON endpoint do not include authentication. Protect `/nodepulse` with the application's own authentication middleware before exposing it outside a trusted environment.

## 3. The main architecture

NodePulse has three internal layers:

```text
                         ┌──────────────────────┐
Express request ────────▶│  Instrumentation     │
                         │  observes lifecycle  │
                         └──────────┬───────────┘
                                    │ metric event
                                    ▼
                         ┌──────────────────────┐
                         │  Rolling storage     │
                         │  buckets + histogram │
                         └──────────┬───────────┘
                                    │ completed aggregates
                                    ▼
                         ┌──────────────────────┐
                         │  Presentation        │
                         │  JSON + dashboard    │
                         └──────────────────────┘
```

The responsibilities are deliberately separate:

1. **Instrumentation** observes requests without deciding how to display them.
2. **Storage** records bounded counters and calculates completed-bucket metrics.
3. **Presentation** turns a storage snapshot into JSON or dashboard rows.

This makes the calculation logic testable without starting a real web server.

## 4. What happens to one request

Consider this request:

```text
GET /api/users/123
```

The Express route is defined as:

```js
router.get("/:id", handler);
```

The complete request flow is:

```text
1. Request enters NodePulse
   │
   ├── Is it NodePulse's own dashboard/JSON traffic?
   │      └── Yes: skip it
   │
   ├── Start a monotonic timer
   │
   └── Allow Express to continue routing

2. Express finishes routing and handling
   │
   ├── response "finish" → completed request
   └── response "close" before finish → aborted request

3. NodePulse resolves the route identity
   │
   └── GET /api/users/:id

4. NodePulse sends a small event to the rolling store
   │
   └── route, status, and duration

5. The event is added to the active time bucket
```

The monitoring code is failure-isolated. If recording unexpectedly fails, NodePulse catches that internal failure so it does not break the application's response.

## 5. Route identity and normalization

The aggregation key is:

```text
HTTP_METHOD normalized_route_pattern
```

Examples:

```text
GET  /api/users/:id
POST /api/users
GET  /api/orders/:orderId
```

Methods remain separate because `GET /orders` and `POST /orders` usually perform different work.

NodePulse uses the Express route pattern instead of the raw URL:

```text
/users/1       ┐
/users/42      ├──▶ GET /users/:id
/users/9382    ┘
```

This prevents one storage entry from being created for every user ID.

For parameterized router mounts, `express.Router({ mergeParams: true })` preserves exact parameter names. When names are unavailable, NodePulse recognizes common numeric IDs, UUIDs, ObjectIds, and long opaque IDs and replaces them with stable names such as `:mountParam1`.

Requests that do not match an Express route are grouped under one fixed key:

```text
unmatched
```

NodePulse never stores every unknown raw URL. This protects memory when scanners request many garbage paths.

## 6. How metrics are stored

All runtime metrics are stored in the Node.js process memory.

The logical structure is:

```text
RollingMetricsStore
│
├── routes: Map
│   ├── GET /api/users/:id
│   │   └── buckets: Map<startTime, RouteBucket>
│   ├── POST /api/orders
│   │   └── buckets: Map<startTime, RouteBucket>
│   └── ...
│
├── other route series
│   └── receives routes beyond the configured route limit
│
└── unmatched buckets
    └── request and HTTP-status counters only
```

### What a route bucket contains

A route bucket stores accumulated values, not individual request objects:

```text
RouteBucket
├── startTimeMs
├── requestCount
├── errorCount
├── abortedCount
├── responseTimeSum
├── responseTimeMin
├── responseTimeMax
└── latency histogram counters
```

For three completed requests of 20 ms, 40 ms, and 60 ms, the bucket stores approximately:

```text
requestCount:       3
responseTimeSum:  120
responseTimeMin:   20
responseTimeMax:   60
histogram:     counters
```

It does not retain three request records. The average is calculated later:

```text
average = responseTimeSum ÷ completedCount
average = 120 ÷ 3
average = 40 ms
```

This aggregation keeps memory bounded and avoids retaining request bodies, response bodies, headers, user IDs, or other request-level data.

## 7. Time buckets and complete-only reporting

The defaults are:

```text
Bucket size: 60 seconds
Retention:   60 minutes
```

Bucket boundaries are anchored to the moment NodePulse starts. If NodePulse starts at `12:00:25`, its first bucket is:

```text
12:00:25 ───────────────────────── 12:01:25
                 60 seconds
```

This prevents a shortened first bucket.

At runtime, a busy route can have:

```text
60 completed retained buckets
+ 1 active bucket
───────────────────────────────
up to 61 physical bucket entries
```

Only completed buckets are reported. The active bucket is excluded from every aggregate:

```text
Completed        Completed        Active
bucket 1         bucket 2         bucket 3
────────         ────────         ────────
10 requests      0 requests       7 requests so far
     │                │                  │
     └────────────────┴──── used         └── ignored until closure
```

This rule applies equally to:

- Request counts
- RPS and dashboard RPM
- Average, minimum, and maximum latency
- p50, p95, and p99
- Error count and error rate
- Aborted count
- Recent trends
- Unmatched request and status counts

The numbers for a route therefore never combine completed traffic with an incomplete interval.

### Warm-up behavior

Before a route's first bucket closes, its aggregate fields are `null` and its state is:

```text
aggregationState: "warming_up"
```

The dashboard displays **Warming up** instead of displaying false zeroes.

At the first bucket boundary, the route becomes:

```text
aggregationState: "ready"
```

### Using all completed buckets

The dashboard asks for the full retention window and combines every completed bucket currently available.

If the server has been running for only three minutes, a 60-minute request has only three completed buckets. NodePulse reports:

```text
windowSeconds:          3600   requested maximum
effectiveWindowSeconds: 180   completed time actually used
```

It does not pretend the server was monitored for the 57 minutes before startup.

Once the server has 60 completed one-minute buckets, the effective window reaches the full 3,600 seconds. As new buckets close, the oldest buckets leave retention.

### Zero-request buckets

A completed interval with no requests is real information:

```text
Minute 1: 10 requests
Minute 2:  0 requests
Minute 3: 20 requests
```

For a three-minute query:

```text
total requests = 10 + 0 + 20 = 30
average RPM    = 30 ÷ 3 = 10
```

NodePulse represents missing intervals for a known retained route as logical zero buckets. It does not need to allocate an empty object for every route every minute.

A zero-request bucket contributes to the time denominator and trend, but it does not invent response samples:

```text
RPM:             0
request count:   0
average latency: null
p95:             null
error rate:      null
```

## 8. Metric calculation logic

Every calculation uses the same set of completed buckets.

### Request rate

The JSON API exposes RPS:

```text
RPS = total request count ÷ effective window seconds
```

The dashboard converts it to average RPM:

```text
RPM = RPS × 60
```

Example:

```text
120 requests across 4 completed minutes

RPS = 120 ÷ 240 = 0.5
RPM = 0.5 × 60  = 30
```

No partial-bucket extrapolation is performed.

### Average response time

```text
average latency = sum of completed response times ÷ completed request count
```

Aborted requests are excluded because they have no clean completed response time.

### Error rate

By default, a completed response is an error when its status code is 500 or greater:

```text
error rate = error count ÷ completed request count
```

The threshold is configurable. When there are no completed responses, the error rate is `null`, not zero.

### Aborted requests

An aborted request increments:

```text
requestCount
abortedCount
```

It does not increment the completed count or error count and does not affect latency or percentile calculations.

## 9. Latency histogram and percentiles

Storing every response duration would make memory grow with traffic. Instead, each time bucket stores 12 histogram counters:

```text
<5 ms
<10 ms
<25 ms
<50 ms
<100 ms
<250 ms
<500 ms
<1,000 ms
<2,500 ms
<5,000 ms
<10,000 ms
≥10,000 ms
```

A latency increments one counter:

```text
Response time: 82 ms
                 │
                 ▼
Histogram bucket: 50–100 ms
```

When multiple completed time buckets are queried, their histogram counters are merged. NodePulse locates the bucket containing the requested percentile rank and linearly interpolates within it.

For the open-ended `≥10,000 ms` range, the maximum observed latency is used as the effective upper boundary. Percentiles are estimates whose error is bounded by the width of the containing histogram range.

## 10. Memory limits and cleanup

NodePulse protects the host application's memory in several ways.

### Route limit

The default maximum is:

```text
maxTrackedRoutes: 200
```

New route keys beyond the limit are grouped into the reserved `other` route series.

### Retention cleanup

Completed data older than retention is removed. An idle route continues showing zero traffic while its last activity is still inside retention. After its last activity expires:

```text
route series removed
       │
       ├── bucket memory released
       └── route slot becomes reusable
```

### Unmatched status limit

Unmatched requests store counts by HTTP status, with at most 32 distinct statuses per bucket and aggregate. Extra statuses are grouped as `other`.

### Process restart

Metrics are process-local:

```text
Server running  → metrics exist in memory
Server restarts → old process memory disappears
New process     → NodePulse starts warming up again
```

NodePulse currently does not write to a file, SQLite, Redis, or an external database.

Multiple Node.js worker processes also have separate stores and separate dashboards. Cross-process aggregation is not part of the current version.

## 11. Dashboard behavior

The dashboard is a self-contained HTML page generated by NodePulse. Its CSS and JavaScript are inline, so it does not download fonts, UI libraries, analytics scripts, or assets from the internet.

It:

- Polls the JSON endpoint every five seconds.
- Shows average RPM across all completed retained buckets.
- Shows average latency, p95, error rate, and completed-bucket trends.
- Displays method badges and normalized routes.
- Explains table columns on hover and keyboard focus.
- Shows explicit warm-up, empty, connection, and error states.
- Excludes its own page loads and polling requests from application metrics.

Polling every five seconds does not mean metrics change every five seconds. Values change only after the next bucket closes.

Dashboard responses include defensive browser headers such as a content security policy, frame denial, no-referrer, and no-store caching.

## 12. JSON metrics API

Default endpoint:

```text
GET /nodepulse/metrics.json
```

Request a shorter bucket-aligned window:

```text
GET /nodepulse/metrics.json?windowSeconds=300
```

The requested window must:

- Be a positive integer.
- Be divisible by `bucketSizeSeconds`.
- Not exceed the configured retention window.

A simplified ready response looks like:

```json
{
  "schemaVersion": 2,
  "generatedAtMs": 1788060000000,
  "aggregationState": "ready",
  "windowSeconds": 3600,
  "effectiveWindowSeconds": 180,
  "bucketSizeSeconds": 60,
  "routes": [
    {
      "routeKey": "GET /api/users/:id",
      "aggregationState": "ready",
      "requestCount": 12,
      "completedCount": 11,
      "errorCount": 1,
      "abortedCount": 1,
      "requestsPerSecond": 0.0666666667,
      "averageResponseTimeMs": 42.5,
      "minimumResponseTimeMs": 8,
      "maximumResponseTimeMs": 210,
      "errorRate": 0.0909090909,
      "p50ResponseTimeMs": 37.5,
      "p95ResponseTimeMs": 187.5,
      "p99ResponseTimeMs": 205.5,
      "recentRequestCounts": [5, 3, 4]
    }
  ],
  "unmatched": {
    "routeKey": "unmatched",
    "aggregationState": "ready",
    "requestCount": 2,
    "statusCounts": { "404": 2 },
    "recentRequestCounts": [1, 0, 1]
  }
}
```

During initial warm-up, aggregate values are explicitly null:

```json
{
  "aggregationState": "warming_up",
  "effectiveWindowSeconds": 0,
  "routes": [
    {
      "routeKey": "GET /api/users/:id",
      "aggregationState": "warming_up",
      "requestCount": null,
      "requestsPerSecond": null,
      "averageResponseTimeMs": null,
      "p95ResponseTimeMs": null,
      "errorRate": null,
      "recentRequestCounts": null
    }
  ]
}
```

Both dashboard and JSON endpoints accept only `GET` and `HEAD`. Other methods receive HTTP 405.

## 13. Configuration reference

```ts
interface NodePulseConfig {
  retentionMinutes?: number;
  bucketSizeSeconds?: number;
  dashboardPath?: string;
  metricsJsonPath?: string;
  errorStatusThreshold?: number;
  maxTrackedRoutes?: number;
  excludePaths?: readonly (string | RegExp)[];
}
```

| Option                 |                   Default | Purpose                                                                |
| ---------------------- | ------------------------: | ---------------------------------------------------------------------- |
| `retentionMinutes`     |                      `60` | Maximum completed history kept in memory.                              |
| `bucketSizeSeconds`    |                      `60` | Duration of one fixed time bucket.                                     |
| `dashboardPath`        |              `/nodepulse` | Browser dashboard path.                                                |
| `metricsJsonPath`      | `/nodepulse/metrics.json` | JSON endpoint path.                                                    |
| `errorStatusThreshold` |                     `500` | Status code at or above which a completed response counts as an error. |
| `maxTrackedRoutes`     |                     `200` | Maximum distinct matched route keys before using `other`.              |
| `excludePaths`         |                      `[]` | Exact normalized paths or safe regular expressions to exclude.         |

Example:

```js
app.use(
  nodepulse({
    retentionMinutes: 30,
    bucketSizeSeconds: 60,
    dashboardPath: "/operations",
    metricsJsonPath: "/operations/metrics.json",
    errorStatusThreshold: 500,
    maxTrackedRoutes: 100,
    excludePaths: ["/health", /^\/internal/],
  }),
);
```

Configuration is validated when `nodepulse()` is called. Invalid values throw immediately during application startup.

Important rules:

- Retention converted to seconds must be divisible by bucket size.
- Paths must start with `/` and cannot contain query strings or fragments.
- Dashboard and JSON paths must be different.
- Stateful regular expressions using `g` or `y` are rejected.
- Exclusions are checked against normalized route patterns, not raw URLs.

## 14. Repository structure

Generated directories such as `dist`, `coverage`, `test-results`, `node_modules`, and `artifacts` are outputs, not source code.

```text
Pulse/
├── src/                         Product source
│   ├── index.ts                 Public middleware factory
│   ├── config.ts                Options, defaults, validation
│   ├── http/
│   │   └── path.ts              Canonical URL-path helper
│   ├── instrumentation/
│   │   └── express-middleware.ts Request lifecycle observation
│   ├── metrics/
│   │   └── histogram.ts         Latency buckets and percentiles
│   ├── storage/
│   │   └── rolling-store.ts     In-memory time buckets and queries
│   └── presentation/
│       ├── http-middleware.ts   Dashboard and JSON endpoints
│       └── dashboard.ts         Self-contained dashboard HTML/CSS/JS
│
├── test/                        Automated tests
│   ├── config.test.ts
│   ├── public-api.test.ts
│   ├── instrumentation/
│   ├── metrics/
│   ├── storage/
│   └── browser/
│
├── examples/
│   └── basic-app.mjs            Local demonstration server
├── scripts/
│   ├── benchmarks/              Speed and memory release gates
│   ├── verify-build.mjs         Built-export verification
│   └── verify-package.mjs       Isolated consumer verification
├── compat/                      Direct CommonJS compatibility files
├── docs/                        Architecture, progress, benchmarks, release
├── .github/workflows/           Hosted CI and release benchmark workflows
├── package.json                 Package contract, scripts, dependencies
├── tsconfig.json                TypeScript rules
├── tsup.config.ts               ESM/CJS build configuration
├── vitest.config.ts             Unit coverage configuration
├── playwright.config.ts         Real Chromium test configuration
├── eslint.config.js             Static code-quality rules
├── README.md                    Short user-facing introduction
├── MANUAL.md                    This complete guide
├── CHANGELOG.md                 Release-visible changes
├── CONTRIBUTING.md              Contributor workflow
├── SECURITY.md                  Security reporting and deployment warning
├── SRS_BASELINE.md              Frozen requirements checksum and decisions
└── LICENSE                      MIT license
```

## 15. Source file responsibilities

### `src/index.ts`

The only public entry point. It:

1. Validates configuration.
2. Creates one private rolling store.
3. Creates presentation middleware.
4. Creates instrumentation middleware.
5. Composes them into one Express middleware function.

Internal storage and histogram classes are intentionally not exported as public APIs.

### `src/config.ts`

Defines public options, default values, resolved internal configuration, and startup validation. Centralizing validation means request handlers do not repeatedly check configuration.

### `src/http/path.ts`

Converts paths into a consistent canonical form. This avoids mismatches caused by repeated or trailing slashes.

### `src/instrumentation/express-middleware.ts`

Observes Express response events, measures duration with a monotonic clock, normalizes route keys, handles aborts and unmatched requests, applies exclusions, and isolates monitoring failures.

### `src/metrics/histogram.ts`

Owns the fixed latency boundaries. It records latency counters, merges completed-bucket histograms, and estimates percentiles through interpolation.

### `src/storage/rolling-store.ts`

The metrics engine. It owns route maps, active and completed time buckets, retention cleanup, route-cardinality protection, warm-up state, zero-interval handling, and aggregate queries.

### `src/presentation/http-middleware.ts`

Owns the dashboard and JSON paths, schema version, window parsing, method restrictions, JSON error responses, and defensive HTTP headers.

### `src/presentation/dashboard.ts`

Generates one self-contained HTML string. Its browser script polls JSON, safely builds DOM elements with text nodes, calculates displayed RPM from API RPS, renders latency indicators and trends, and handles warm-up/error/empty states.

## 16. Test file responsibilities

| Test                                              | What it protects                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `test/config.test.ts`                             | Defaults and invalid startup configuration.                                                                            |
| `test/metrics/histogram.test.ts`                  | Bucket boundaries, interpolation, merging, and validation.                                                             |
| `test/storage/rolling-store.test.ts`              | Completion boundaries, warm-up, zero buckets, aggregation, retention, cardinality, unmatched traffic, and percentiles. |
| `test/instrumentation/express-middleware.test.ts` | Express lifecycle events, route normalization, mounted routers, aborts, exclusions, and failure isolation.             |
| `test/public-api.test.ts`                         | Middleware composition, schema-v2 JSON, endpoint behavior, authentication ordering, and build-facing API.              |
| `test/browser/dashboard.spec.ts`                  | Real Chromium rendering, desktop/mobile usability, tooltips, warm-up UI, browser errors, and external requests.        |

## 17. Build and package flow

Source is written once in TypeScript and built into both module formats:

```text
TypeScript source
      │
      ▼
     tsup
      │
      ├── dist/index.js      ESM
      ├── dist/index.cjs     generated CJS build
      ├── dist/index.d.ts    ESM types
      └── source maps

compat/index.cjs             direct CommonJS require facade
compat/index.d.cts           CommonJS declaration facade
```

The package export map makes both forms work:

```js
import nodepulse from "@madhavmahajan132/nodepulse";
```

```js
const nodepulse = require("@madhavmahajan132/nodepulse");
```

Consumers receive compiled JavaScript and type declarations. They do not need to use TypeScript themselves.

## 18. Development commands

Install development dependencies:

```powershell
npm.cmd install
```

Run the complete normal quality gate:

```powershell
npm.cmd run check
```

Run individual checks:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run test:coverage
npm.cmd run test:browser
npm.cmd run build
```

Run the example:

```powershell
npm.cmd run example
```

Run performance gates:

```powershell
npm.cmd run benchmark:overhead
npm.cmd run benchmark:memory
npm.cmd run benchmark:memory:release
```

Verify the publishable package in isolated ESM, CommonJS, and TypeScript consumers:

```powershell
npm.cmd run verify:package
```

## 19. Supported environments

- Node.js 22 or newer according to the current package engine declaration.
- Express 4.18 through Express 5.x.
- ESM and CommonJS applications.
- TypeScript and plain JavaScript consumers.

CI is designed to test Node.js 22/24 crossed with Express 4/5. Chromium provides real dashboard validation.

## 20. Current limitations

NodePulse currently does not provide:

- Persistent metrics across process restarts.
- Multi-process or multi-server aggregation.
- Built-in dashboard authentication.
- Distributed tracing.
- Request or response body capture.
- Alert delivery.
- Exact percentiles based on retained raw samples.
- A public storage or query extension API.

These boundaries keep the first version small, bounded, private, and safe to embed inside an Express application.

## 21. Troubleshooting

### Dashboard shows “Warming up”

This is expected until the first complete bucket closes. With the default configuration, wait one full minute after NodePulse starts.

### Metrics update less often than dashboard polling

The page polls every five seconds, but calculations change only when a complete bucket becomes available. The default update interval is therefore one minute.

### A dynamic mount has `:mountParam1`

Use `express.Router({ mergeParams: true })` if the exact mount parameter name matters. The generic name is a safe fallback that prevents identifier cardinality.

### A route does not appear

Check that:

- NodePulse is mounted before the route.
- The route is not in `excludePaths`.
- Its first bucket has had time to close.
- Its historical activity has not expired from retention.
- It has not been grouped into `other` because of `maxTrackedRoutes`.

### Metrics disappear after restart

This is expected in the current in-memory design. Persistence requires a separate storage milestone.

### PowerShell blocks `npm.ps1`

Use `npm.cmd` in commands, as shown throughout this manual.

## 22. Documentation map

- `README.md` — short installation and usage introduction.
- `MANUAL.md` — complete plain-language product and developer guide.
- `docs/ARCHITECTURE.md` — concise engineering decisions.
- `docs/BENCHMARKS.md` — benchmark method and measured results.
- `docs/PROGRESS.md` — milestone-by-milestone development report.
- `docs/RELEASE_CHECKLIST.md` — actions required before publishing.
- `CHANGELOG.md` — changes visible to package consumers.
- `CONTRIBUTING.md` — contributor expectations and commands.
- `SECURITY.md` — security policy and dashboard exposure warning.
- `SRS_BASELINE.md` — frozen requirements identity and approved changes.
