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

## 2026-08-30 — Compatibility and performance gates completed

### Completed

- Added a four-way CI matrix covering Node.js 22/24 and Express 4/5.
- Added real Chromium dashboard checks at desktop and mobile viewport sizes.
- Verified live route rendering, accessible roles, polling success, no browser errors, and no external asset requests.
- Added a repeatable p95 HTTP overhead benchmark with a strict 1 ms gate.
- Measured 0.491 ms local p95 overhead on the documented reference machine.
- Added bounded-memory smoke and release simulations at 500 RPS across 50 routes.
- Completed the full 3.6-million-request release simulation; post-retention-fill heap growth was 96,136 bytes against a 10 MiB ceiling.
- Added normal-CI smoke gates and a manually triggered full release benchmark workflow.

### Next

- Resolve parameterized router-mount normalization.
- Add README installation and release metadata once the npm package name and repository are finalized.
- Run the compatibility matrix and benchmarks on GitHub-hosted reference runners.
- Prepare the first pre-release package and changelog.

### Plain-language status

NodePulse now has automated compatibility, browser, speed, and memory checks. Local results satisfy the v1 performance and bounded-memory requirements; GitHub-hosted runs will become the shared release record once the repository is connected.

## 2026-08-30 — Alpha package candidate prepared

### Completed

- Added parameterized router-mount normalization without reading private Express router internals.
- Preserved exact mount parameter names when `mergeParams` is enabled and added stable ID-shaped fallbacks otherwise.
- Confirmed `nodepulse` and `nodepulse-apm` were not present in the npm registry at the time of checking.
- Set the candidate version to `0.1.0-alpha.1` while retaining `private: true` to prevent accidental publication.
- Added MIT licensing, changelog, contribution guidance, security policy, and an explicit release checklist.
- Packed and installed the tarball in an isolated consumer environment.
- Verified ESM, direct CommonJS, ESM TypeScript, and CommonJS TypeScript consumption from the packed artifact.
- Created `nodepulse-0.1.0-alpha.1.tgz` with SHA-256 `A85AACE9E2B9303DCF4A3EFE52FDD2DE8C393F958EB301CBA3F700F514D7AE00`.

### Remaining release blockers

- Choose the canonical GitHub repository and add its URLs to package metadata.
- Enable private vulnerability reporting and run hosted CI.
- Confirm npm ownership immediately before publishing.
- Remove `private: true` only when the external release checklist is complete.

### Plain-language status

The first alpha is packaged and verified locally, but intentionally cannot be published yet. The remaining work requires repository and npm-account decisions rather than more local implementation.

### Known tooling note

The dependency audit currently reports one low-severity advisory in esbuild 0.27, pulled in by the build tool. It affects running a local development server on Windows; NodePulse does not run that server or ship esbuild to consumers. The upstream build tool currently requires the affected release line, so this will be upgraded when a compatible patched release is available.

## 2026-08-30 — Dashboard visual refresh completed

### Completed

- Reworked the dashboard into a cleaner, more distinctive dark visual system with lime, violet, and coral accents.
- Added a compact live-connection indicator, clearer metric hierarchy, HTTP method badges, and visual p95 latency bars.
- Improved table scanning, hover feedback, empty and error states, and small-screen card layout.
- Kept the dashboard self-contained: no external fonts, scripts, styles, images, or UI dependencies.
- Preserved semantic HTML, reduced-motion support, safe DOM rendering, and automatic metrics polling.

### Plain-language status

The dashboard now feels like a focused product interface instead of a basic metrics table, while staying fast, private, and usable on desktop and mobile.

## 2026-08-30 — Dashboard RPM and metric guidance completed

### Completed

- Changed the dashboard throughput display from RPS to average RPM for easier reading on lower-traffic applications.
- Kept the JSON API's existing `requestsPerSecond` field stable and performed the conversion only in the dashboard.
- Added concise explanations to every table heading on mouse hover and keyboard focus.
- Documented that RPM covers the selected window and that aborted requests do not affect completed-request latency.

### Plain-language status

The dashboard now expresses traffic in a friendlier unit and explains each metric in place without making the table visually busy.

## 2026-08-30 — Complete-bucket-only reporting completed

### Completed

- Anchored buckets to NodePulse startup so no shortened first interval is reported.
- Excluded the active bucket uniformly from traffic, latency, percentile, error, unmatched, and trend calculations.
- Made the dashboard combine all completed buckets available in the retention window.
- Added honest early-window handling through `effectiveWindowSeconds` instead of padding pre-start time with zeroes.
- Preserved completed zero-request intervals while leaving latency and error statistics empty when no response samples exist.
- Added explicit `warming_up` and `ready` states and advanced the JSON contract to schema v2.
- Kept idle routes visible with zero traffic until their last activity leaves retention.
- Passed 51 automated tests and 3 Chromium dashboard scenarios.
- Maintained 95.3% line coverage, 91.48% branch coverage, and 100% function coverage.
- Repassed the `<1 ms p95` overhead gate at 0.735 ms and the 3.6-million-request memory gate with 111,504 bytes of post-fill growth.

### Plain-language status

Every number shown for a route now comes from the same set of fully finished time buckets. Values change only when a bucket closes, so the dashboard cannot mix partial live traffic with completed historical measurements.

## 2026-08-30 — Product and developer manual completed

### Completed

- Added a plain-language manual covering installation, middleware placement, architecture, request flow, route normalization, in-memory storage, completed buckets, formulas, histograms, API schema, configuration, and limitations.
- Added text diagrams and worked examples that remain readable in terminals and basic Markdown viewers.
- Documented the complete repository structure and the responsibility of every product, test, build, benchmark, and documentation area.
- Added development, packaging, troubleshooting, and security guidance in one place.

### Plain-language status

A new developer can now understand how NodePulse works, find the correct source file, run the project, and reason about each dashboard number without first reading the entire codebase.

## 2026-08-30 — Version 1 npm release preparation

### Completed

- Connected the canonical GitHub repository metadata to `Madhav-Mahajan-13/Pulse`.
- Promoted the package identity from the alpha candidate to `nodepulse@1.0.0`.
- Removed the private publication guard and added npm-facing repository, homepage, and issue links.
- Added a GitHub trusted-publishing workflow for releases after the initial npm package creation.
- Reconfirmed immediately before preparation that the unscoped `nodepulse` registry name was unclaimed.
- Built and isolated-consumer verified the 70,706-byte `nodepulse-1.0.0.tgz` release artifact with SHA-256 `5D415D42F0708911C0CD2CABEF1FCED443982055C339E53D35296FC306C6879B`.

### Remaining external actions

- Make the GitHub repository publicly readable and push the two local v1 commits plus these release changes.
- Log into npm with 2FA, perform the first publication, and verify the public installation.
- Configure the npm trusted publisher and create the `v1.0.0` GitHub release.

### Plain-language status

The code and package metadata are being finalized as version 1.0.0. Publication now depends on GitHub visibility and npm account authentication rather than product implementation work.
