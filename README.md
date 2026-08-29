# NodePulse APM

Zero-configuration, self-hosted application performance monitoring for Node.js and Express.

## Development status

NodePulse is in active pre-release development. Configuration validation, the latency histogram, bounded rolling storage, and internal Express request instrumentation are implemented; the public middleware and dashboard are not available yet. The package is marked `private` to prevent accidental publication during this stage.

The approved requirements are frozen in [`SRS_NodePulse_APM.docx`](./SRS_NodePulse_APM.docx), with its checksum recorded in [`SRS_BASELINE.md`](./SRS_BASELINE.md).

## Local development

Node.js 22 or 24 is required.

```sh
npm install
npm run check
npm run test:coverage
```

`npm run check` verifies formatting, lint rules, strict TypeScript types, unit tests, and both ESM and CommonJS builds.

## Planned dashboard security

The v1 dashboard will intentionally have no built-in authentication. Applications must protect the configured dashboard and JSON paths with their own authentication middleware before exposing them outside a trusted environment.
