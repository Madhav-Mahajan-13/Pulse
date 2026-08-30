# Security policy

## Supported versions

Security fixes are provided for the latest published major version of NodePulse. Version 1.x is currently supported.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Use GitHub's private vulnerability-reporting feature under the repository Security tab. If that channel is temporarily unavailable, contact the repository owner privately before disclosing details.

Reports should include the affected version, reproduction steps, impact, and any suggested mitigation. Maintainers should acknowledge a complete report within five business days and coordinate disclosure after a fix is available.

## Dashboard exposure

The dashboard and JSON endpoint do not include authentication. Operators must place application authentication middleware before the configured NodePulse paths and must not expose them publicly by default.
