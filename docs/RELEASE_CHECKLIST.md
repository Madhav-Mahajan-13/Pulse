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
- [x] The unscoped `nodepulse` name returned registry 404 immediately before release preparation.
- [ ] Make the GitHub repository publicly readable so npm source links and provenance can be verified.
- [ ] Push the local v1 release commits and confirm hosted CI passes on `main`.
- [ ] Enable GitHub private vulnerability reporting.
- [ ] Log this machine into npm with an account protected by 2FA.
- [ ] Publish `nodepulse@1.0.0` publicly with the `latest` dist-tag.
- [ ] Verify the registry metadata and install the published package in a clean consumer.
- [ ] Configure npm trusted publishing for `.github/workflows/publish.yml` after the first package version exists.
- [ ] Create and push the signed or annotated `v1.0.0` Git tag and GitHub release.

## First publication

The initial package creation must be performed by an authenticated npm owner. Provenance is intentionally not requested for the first local publication because npm provenance is generated only by supported hosted CI. Future versions should use the trusted-publishing workflow.

## Release identity

- Version: `1.0.0`
- Package: `nodepulse`
- Local artifact: `artifacts/nodepulse-1.0.0.tgz` (70,706 bytes)
- Artifact SHA-256: `5D415D42F0708911C0CD2CABEF1FCED443982055C339E53D35296FC306C6879B`
- GitHub: `https://github.com/Madhav-Mahajan-13/Pulse`
- Requirements baseline: SRS 0.3 plus the approved complete-bucket reporting decision in `SRS_BASELINE.md`.
