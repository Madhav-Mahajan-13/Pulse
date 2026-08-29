# Security policy

## Supported versions

NodePulse is currently prerelease software. Only the latest published prerelease will receive security fixes until version 1.0.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Once the repository is connected to GitHub, use its private vulnerability-reporting feature under the Security tab. Until that reporting channel exists, this prerelease must not be published.

Reports should include the affected version, reproduction steps, impact, and any suggested mitigation. Maintainers should acknowledge a complete report within five business days and coordinate disclosure after a fix is available.

## Dashboard exposure

The dashboard and JSON endpoint do not include authentication. Operators must place application authentication middleware before the configured NodePulse paths and must not expose them publicly by default.
