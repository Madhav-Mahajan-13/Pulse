# Development progress

## 2026-08-30 — Foundation started

### Completed

- Froze SRS version 0.3 as the v1 pre-implementation baseline.
- Confirmed Node.js 22 and 24 as the supported LTS lines at development start.
- Added strict TypeScript, build, test, coverage, formatting, and lint foundations.
- Implemented configuration defaults and startup validation.
- Implemented the twelve-bucket latency histogram and percentile interpolation.
- Added unit tests for configuration and histogram edge cases.
- Passed formatting, linting, strict type-checking, 16 unit tests, and dual-format builds.
- Reached 97.14% line coverage and 100% function coverage for the current core.

### Next

- Connect Express request lifecycle instrumentation.
- Normalize matched Express routes into `METHOD /path/:parameter` keys.
- Add finish/close handling with double-recording protection.

### Plain-language status

The project skeleton and the first metrics building block are in place. No usable middleware is exposed yet; this prevents an unfinished no-op package from appearing functional.

## 2026-08-30 — Rolling store completed

### Completed

- Added bucket-aligned rolling storage with automatic retention expiry.
- Added matched-route cardinality limits and the reserved `other` route.
- Added bounded unmatched status counts with an `other` status overflow.
- Added completed, error, and aborted request accounting.
- Added shorter rolling-window queries, RPS, averages, error rate, min/max, and p50/p95/p99 calculations.
- Verified bucket rollover, expiry, reclaimed route slots, histogram merging, query validation, and overflow behavior.
- Passed the full quality gate with 27 tests, 97.52% line coverage, 91.57% branch coverage, and 100% function coverage.

### Plain-language status

The metrics engine can now safely retain and calculate bounded in-memory data. It is not connected to Express yet; request lifecycle instrumentation is the next milestone.

## 2026-08-30 — Express instrumentation completed

### Completed

- Connected real Express request lifecycles to the metrics recorder.
- Added `METHOD /normalized/path` keys for direct routes and static router mounts.
- Added monotonic response timing and status-code recording.
- Added `finish`/`close` handling with double-recording protection.
- Added abort, unmatched, dashboard self-traffic, and custom exclusion behavior.
- Confirmed monitoring failures cannot break the host response.
- Tested the same integration suite against patched Express 4 and Express 5 releases.
- Passed 34 tests with 97.04% line coverage, 93.21% branch coverage, and 100% function coverage.

### Known limitation

Express does not expose the original pattern for parameterized router mount paths through its public request metadata. Direct dynamic routes work correctly, but a mount such as `/accounts/:accountId` needs a separate compatibility design to avoid literal account IDs entering the base path. The route cap still bounds memory while this is addressed.

### Next

- Build the JSON metrics endpoint and define its stable response schema.
- Build the self-contained HTML dashboard.
- Compose storage, instrumentation, and presentation behind `nodepulse(options?)`.

### Plain-language status

Real Express traffic can now flow into the metrics engine correctly for standard direct routes. The next milestone makes those metrics visible through JSON and the browser dashboard.

## 2026-08-30 — Public middleware and dashboard completed

### Completed

- Added the single public `nodepulse(options?)` middleware factory.
- Added versioned JSON metrics with bucket-aligned window queries and structured validation errors.
- Added the self-contained, automatically refreshing HTML dashboard with route summaries and sparklines.
- Added defensive dashboard headers and read-only endpoint enforcement.
- Added direct ESM default-import and CommonJS require compatibility, verified from built artifacts.
- Added an npm package dry run confirming only intended runtime files would be published.
- Added a locally bound example application for safe browser testing.
- Smoke-tested the built example end to end: dynamic, fast, and error routes appeared in schema-v1 JSON and the dashboard returned HTTP 200.
- Passed 42 tests with 96.47% line coverage, 92.4% branch coverage, and 100% function coverage.

### Next

- Add CI matrices for Node.js 22/24 and Express 4/5.
- Add performance and bounded-memory benchmark harnesses.
- Refine dashboard interaction and accessibility through browser-level testing.
- Resolve parameterized router-mount normalization without private Express internals.

### Plain-language status

NodePulse now works end to end: application requests are measured, stored, exposed as JSON, and shown in a browser dashboard. It remains private and pre-release while compatibility and performance gates are completed.

### Known tooling note

The dependency audit currently reports one low-severity advisory in esbuild 0.27, pulled in by the build tool. It affects running a local development server on Windows; NodePulse does not run that server or ship esbuild to consumers. The upstream build tool currently requires the affected release line, so this will be upgraded when a compatible patched release is available.
