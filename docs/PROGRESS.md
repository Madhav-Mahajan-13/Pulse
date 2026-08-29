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

### Known tooling note

The dependency audit currently reports one low-severity advisory in esbuild 0.27, pulled in by the build tool. It affects running a local development server on Windows; NodePulse does not run that server or ship esbuild to consumers. The upstream build tool currently requires the affected release line, so this will be upgraded when a compatible patched release is available.
