# Architecture

NodePulse follows the frozen SRS and separates three responsibilities:

1. Instrumentation observes Express request lifecycles and emits small metric events.
2. Storage keeps bounded, per-route rolling buckets and calculates aggregates.
3. Presentation reads aggregates through the internal storage interface and serves HTML and JSON.

Only the middleware factory will be public. Configuration, histogram, storage, and query modules remain internal so they can evolve without breaking consumers.

## Current implementation

The first implementation slice contains configuration validation and the fixed-bucket latency histogram. The rolling store will build on these modules next.

## Toolchain decisions

- Node.js 22 is the minimum runtime; CI will verify Node.js 22 and 24.
- TypeScript is pinned to the 5.9 release line because the current declaration bundler is not yet compatible with TypeScript 6.
- Build output is generated in ESM and CommonJS formats from the same source.
- Configuration rejects HTTP error thresholds outside 400–599 and stateful exclusion regular expressions.
