# Prerelease checklist

## Automated gates

- [x] Formatting, linting, and strict TypeScript checks pass.
- [x] Unit and Express integration tests pass.
- [x] Chromium dashboard tests pass.
- [x] ESM and CommonJS built exports are verified.
- [x] Packed tarball installs in isolated ESM, CommonJS, and TypeScript consumers.
- [x] Production dependency audit reports no vulnerabilities.
- [x] Middleware overhead is below 1 ms p95 locally.
- [x] Full bounded-memory simulation passes locally.

## External setup still required

- [ ] Choose and create the canonical GitHub repository.
- [ ] Add `repository`, `homepage`, and `bugs` URLs to `package.json`.
- [ ] Enable GitHub private vulnerability reporting.
- [ ] Run the CI matrix and benchmarks on GitHub-hosted runners.
- [ ] Confirm npm ownership of the currently unclaimed `nodepulse` name.
- [ ] Remove `private: true` only after all items above pass.
- [ ] Publish with the `next` dist-tag; do not use `latest` for an alpha.

## Release identity

- Candidate version: `0.1.0-alpha.1`
- Local artifact: `artifacts/nodepulse-0.1.0-alpha.1.tgz`
- Artifact SHA-256: `A85AACE9E2B9303DCF4A3EFE52FDD2DE8C393F958EB301CBA3F700F514D7AE00`
- Package name checked on 2026-08-30: `nodepulse` returned registry 404 (apparently unclaimed at that moment).
- Requirements baseline: SRS 0.3, checksum recorded in `SRS_BASELINE.md`.
