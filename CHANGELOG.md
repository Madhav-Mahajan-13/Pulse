# Changelog

All notable changes will be documented here. This project follows Semantic Versioning and uses prerelease identifiers while the public contract is being validated.

## [0.1.0-alpha.1] - 2026-08-30

### Added

- Single `nodepulse(options?)` Express middleware factory.
- Automatic method-and-route instrumentation with abort and unmatched tracking.
- Bounded rolling in-memory metrics storage.
- Fixed-bucket p50, p95, and p99 latency estimation.
- Versioned JSON metrics endpoint.
- Self-contained, automatically refreshing dashboard.
- Dual ESM and CommonJS package output with TypeScript declarations.
- Node.js 22/24 and Express 4/5 compatibility matrix.
- Unit, integration, browser, overhead, and bounded-memory release gates.

### Changed

- Refreshed the dashboard with a minimalist high-contrast design, responsive metric cards, route method badges, latency indicators, and clearer live status feedback.

### Known limitations

- Metrics are process-local and reset on restart.
- Multi-process aggregation, persistence, alerting, and built-in authentication are not included.
- Parameter names for mounted routers require Express `mergeParams`; otherwise ID-shaped mount values use stable generic placeholders.
