# NodePulse APM

Zero-configuration, self-hosted application performance monitoring for Node.js and Express.

NodePulse is in active pre-release development and is not published yet. The public middleware, rolling metrics engine, JSON endpoint, and first dashboard are implemented. The package remains `private` to prevent accidental publication before release checks are complete.

> **Security:** The dashboard and JSON endpoint have no built-in authentication. Never expose them publicly without placing your own authentication middleware before NodePulse.

## Try it locally

Node.js 22 or 24 is required.

```powershell
npm.cmd install
npm.cmd run example
```

Generate some sample traffic:

- `http://127.0.0.1:3000/fast`
- `http://127.0.0.1:3000/slow/123`
- `http://127.0.0.1:3000/error`

Then open `http://127.0.0.1:3000/nodepulse`.

## Application usage

ES modules:

```js
import express from "express";
import nodepulse from "nodepulse";

const app = express();
app.use(nodepulse());
```

CommonJS:

```js
const express = require("express");
const nodepulse = require("nodepulse");

const app = express();
app.use(nodepulse());
```

Protect the default endpoints with host authentication:

```js
app.use("/nodepulse", requireAuth);
app.use(nodepulse());
```

The dashboard is served at `/nodepulse`. Raw metrics are available at `/nodepulse/metrics.json`; a bucket-aligned sub-window can be requested with `?windowSeconds=300`.

## Configuration

```js
app.use(
  nodepulse({
    retentionMinutes: 60,
    bucketSizeSeconds: 60,
    dashboardPath: "/nodepulse",
    metricsJsonPath: "/nodepulse/metrics.json",
    errorStatusThreshold: 500,
    maxTrackedRoutes: 200,
    excludePaths: ["/health", /^\/internal/],
  }),
);
```

Invalid options throw immediately during application startup.

For parameterized router mounts, create the router with `express.Router({ mergeParams: true })` when mount values can be short slugs. Common numeric, UUID, ObjectId, and opaque ID values are normalized automatically even when parameter names are unavailable.

## Development checks

```powershell
npm.cmd run check
npm.cmd run test:coverage
npm.cmd run test:browser
npm.cmd run benchmark:overhead
npm.cmd run benchmark:memory
```

The frozen requirements are recorded in [`SRS_BASELINE.md`](./SRS_BASELINE.md). Architecture, benchmark methodology, and progress notes live under [`docs`](./docs/).
