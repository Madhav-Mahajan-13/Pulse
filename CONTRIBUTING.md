# Contributing

Thank you for helping improve NodePulse.

## Development setup

Node.js 22 or 24 is required.

```powershell
npm.cmd install
npm.cmd run check
npm.cmd run test:coverage
npm.cmd run test:browser
```

## Working agreement

- Treat the frozen SRS as the v1 requirements contract.
- Keep the public API limited to `nodepulse(options?)` unless a versioned design change is approved.
- Add focused tests for behavior changes and regressions.
- Keep request-path work allocation-conscious and non-blocking.
- Update `CHANGELOG.md` and `docs/PROGRESS.md` for user-visible changes.
- Never introduce outbound telemetry or third-party assets into the default package.

## Before submitting a change

Run the full local gate:

```powershell
npm.cmd run check
npm.cmd run test:browser
npm.cmd run benchmark:memory
```

Performance-sensitive changes should also run `npm.cmd run benchmark:overhead` and include the environment and result in the change description.
