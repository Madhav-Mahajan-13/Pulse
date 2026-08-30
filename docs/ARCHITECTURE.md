# Architecture

NodePulse follows the frozen SRS and separates three responsibilities:

1. Instrumentation observes Express request lifecycles and emits small metric events.
2. Storage keeps bounded, per-route rolling buckets and calculates aggregates.
3. Presentation reads aggregates through the internal storage interface and serves HTML and JSON.

Only the middleware factory will be public. Configuration, histogram, storage, and query modules remain internal so they can evolve without breaking consumers.

## Current implementation

The first implementation slice contains configuration validation and the fixed-bucket latency histogram. The rolling store will build on these modules next.

## Rolling store

- Buckets are anchored to NodePulse startup, so the first reported interval is always a full bucket.
- Active buckets accept metric events but are excluded completely from every aggregate query.
- Queries combine all completed buckets in the requested window and expose the completed duration as `effectiveWindowSeconds` when server uptime is shorter than that window.
- Missing completed buckets for a retained route are explicit zero-request intervals. They affect the rate denominator but never invent latency or error samples.
- Each matched route owns at most the configured number of completed retained buckets plus its active bucket.
- The matched-route map is capped by `maxTrackedRoutes`; additional keys share the reserved `other` series.
- Idle routes continue to report completed zero-request intervals until their last activity expires, then their cardinality slots are reused.
- Aborted requests count toward traffic and `abortedCount`, but not completed latency or error-rate calculations.
- Unmatched requests use a separate bucket shape containing request and status counts only.
- Unmatched status codes are capped at 32 distinct values per bucket and per aggregate query; excess values use the `other` status entry.
- Query windows must be bucket-aligned and cannot exceed configured retention.

## Express instrumentation

- A monotonic high-resolution clock measures completed response duration.
- Route keys are created after Express resolves the request, using `METHOD /normalized/path`.
- `finish` records a completed response; `close` before `finish` records an abort.
- Both listeners share an idempotent guard, so a request can never be recorded twice.
- Dashboard and JSON paths are skipped before listeners are attached. Other exclusions are matched against the normalized route pattern after routing.
- Requests without `req.route` at completion are stored as unmatched status counts.
- Recording failures are isolated and never escape into the host response lifecycle.
- The integration suite is verified against both supported Express major versions.

### Mounted router normalization

Express exposes direct route patterns through `req.route.path`, but mounted `baseUrl` values may contain literal parameter values. NodePulse normalizes them without private router internals:

- Routers created with `mergeParams: true` retain the original parameter names.
- Numeric IDs, UUIDs, 24-character hexadecimal ObjectIds, and long opaque identifiers containing digits use stable `:mountParamN` placeholders when names are unavailable.
- Static mount segments remain unchanged.

An arbitrary short slug on a router without `mergeParams` cannot be distinguished from a static segment through public Express request metadata. Applications using such mounts should enable `mergeParams` to preserve exact aggregation.

## Presentation and public composition

- `nodepulse(options?)` validates configuration once and creates one private store per middleware instance.
- Presentation handles the configured dashboard and JSON paths before instrumentation, keeping self-traffic out of metrics.
- The JSON response carries `schemaVersion: 2`, explicit `warming_up`/`ready` states, nullable warm-up metrics, `bucketSizeSeconds`, and `effectiveWindowSeconds`.
- The dashboard requests the full retention window and combines every completed bucket available within it. No displayed route metric includes the active bucket.
- Invalid windows return a structured HTTP 400 response; non-read methods on owned endpoints return HTTP 405.
- The dashboard contains inline CSS and JavaScript only, polls every five seconds, and builds route rows with DOM text nodes to avoid HTML injection.
- Dashboard responses set no-store, content-type, framing, referrer, and content-security headers.
- ESM imports use the generated ESM bundle. CommonJS uses a small compatibility facade so `require("@madhavmahajan132/nodepulse")` returns the function directly rather than a `{ default }` wrapper.

## Release gates

- CI covers Node.js 22 and 24 crossed with Express 4 and 5.
- Chromium tests exercise the actual built dashboard at desktop and mobile viewports.
- The overhead harness compares p95 localhost HTTP latency against an uninstrumented Express baseline and enforces the SRS limit of less than 1 ms.
- The memory harness drives the internal store with a deterministic clock. Its release profile simulates 3.6 million requests across 120 minutes and verifies heap growth plateaus after the 60-minute retention window fills.
- Full memory profiling is available as a manually triggered release workflow; shorter smoke profiles run during normal CI.

## Toolchain decisions

- Node.js 22 is the minimum runtime; CI will verify Node.js 22 and 24.
- TypeScript is pinned to the 5.9 release line because the current declaration bundler is not yet compatible with TypeScript 6.
- Build output is generated in ESM and CommonJS formats from the same source.
- Configuration rejects HTTP error thresholds outside 400–599 and stateful exclusion regular expressions.
