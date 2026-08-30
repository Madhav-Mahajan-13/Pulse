# Version 1.0.0 release checklist

## Automated gates

- [x] Formatting, linting, and strict TypeScript checks pass.
- [x] All unit and Express integration tests pass.
- [x] Chromium desktop, mobile, tooltip, and warm-up tests pass.
- [x] ESM and CommonJS built exports are verified.
- [x] Packed output installs in isolated ESM, CommonJS, and TypeScript consumers.
- [x] Production dependency audit reports no vulnerabilities.
- [x] Middleware overhead is below 1 ms p95 locally.
- [x] The 3.6-million-request bounded-memory release simulation passes locally.

## Repository and registry

- [x] Canonical GitHub repository created at `Madhav-Mahajan-13/Pulse`.
- [x] `repository`, `homepage`, and `bugs` package metadata added.
- [x] Package promoted to version `1.0.0` and the private publish guard removed.
- [x] npm rejected the unscoped `nodepulse` name as too similar to the existing `node-pulse` package.
- [x] Adopted npm's recommended owned scope: `@madhavmahajan132/nodepulse`.
- [ ] Make the GitHub repository publicly readable so npm source links and provenance can be verified.
- [ ] Push the local v1 release commits and confirm hosted CI passes on `main`.
- [ ] Enable GitHub private vulnerability reporting.
- [x] Logged this machine into npm as `madhavmahajan132` with publishing 2FA enabled.
- [x] Published `@madhavmahajan132/nodepulse@1.0.0` publicly with the `latest` dist-tag.
- [x] Verified public registry metadata and clean CommonJS/ESM installation from npm.
- [ ] Configure npm trusted publishing for `.github/workflows/publish.yml` after the first package version exists.
- [ ] Create and push the annotated `v1.0.0` Git tag and GitHub release.

## First publication

The initial package creation was performed by the authenticated npm owner with browser-based 2FA. Provenance was intentionally not requested for the first local publication because npm provenance is generated only by supported hosted CI. Future versions should use the trusted-publishing workflow.

## Release identity

- Version: `1.0.0`
- Package: `@madhavmahajan132/nodepulse`
- Local artifact: `artifacts/madhavmahajan132-nodepulse-1.0.0.tgz` (70,793 bytes)
- Artifact SHA-256: `08F6F87DF1F0693C127123E5762322D584C818D00864D261B79869CAF843EE6D`
- GitHub: `https://github.com/Madhav-Mahajan-13/Pulse`
- Requirements baseline: SRS 0.3 plus the approved complete-bucket reporting decision in `SRS_BASELINE.md`.
