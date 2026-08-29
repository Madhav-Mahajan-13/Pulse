import { EventEmitter } from "node:events";

import express from "express";
import type { Request, Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { resolveConfig } from "../../src/config.js";
import {
  createInstrumentationMiddleware,
  normalizeRoutePath,
  type MetricsRecorder,
} from "../../src/instrumentation/express-middleware.js";
import { RollingMetricsStore } from "../../src/storage/rolling-store.js";

function createHarness(
  configOverrides: Parameters<typeof resolveConfig>[0] = {},
) {
  const config = resolveConfig(configOverrides);
  const store = new RollingMetricsStore(config);
  const app = express();
  app.use(createInstrumentationMiddleware(config, store));
  return { app, store };
}

describe("Express instrumentation", () => {
  it("normalizes route parameters and separates HTTP methods", async () => {
    const { app, store } = createHarness();
    app.get("/users/:id", (_request, response) =>
      response.status(200).send("ok"),
    );
    app.post("/users/:id", (_request, response) =>
      response.status(201).send("ok"),
    );

    await request(app).get("/users/123?expanded=true").expect(200);
    await request(app).post("/users/456").expect(201);

    expect(store.query(60).routes.map(({ routeKey }) => routeKey)).toEqual([
      "GET /users/:id",
      "POST /users/:id",
    ]);
  });

  it("includes a statically mounted router base path", async () => {
    const { app, store } = createHarness();
    const router = express.Router();
    router.get("/orders/:orderId", (_request, response) => response.send("ok"));
    app.use("/api", router);

    await request(app).get("/api/orders/42").expect(200);

    expect(store.query(60).routes[0]?.routeKey).toBe(
      "GET /api/orders/:orderId",
    );
  });

  it("preserves named parameters from a merged router mount", async () => {
    const { app, store } = createHarness();
    const router = express.Router({ mergeParams: true });
    router.get("/orders/:orderId", (_request, response) => response.send("ok"));
    app.use("/accounts/:accountId", router);

    await request(app).get("/accounts/42/orders/7").expect(200);

    expect(store.query(60).routes[0]?.routeKey).toBe(
      "GET /accounts/:accountId/orders/:orderId",
    );
  });

  it("uses a stable fallback for ID-shaped mounts without merged parameters", async () => {
    const { app, store } = createHarness();
    const router = express.Router();
    router.get("/orders/:orderId", (_request, response) => response.send("ok"));
    app.use("/accounts/:accountId", router);

    await request(app).get("/accounts/42/orders/7").expect(200);
    await request(app).get("/accounts/99/orders/8").expect(200);

    expect(store.query(60).routes).toMatchObject([
      {
        routeKey: "GET /accounts/:mountParam1/orders/:orderId",
        requestCount: 2,
      },
    ]);
  });

  it("records error responses and unmatched status counts", async () => {
    const { app, store } = createHarness();
    app.get("/failure", (_request, response) => response.sendStatus(503));

    await request(app).get("/failure").expect(503);
    await request(app).get("/missing").expect(404);

    const snapshot = store.query(60);
    expect(snapshot.routes[0]).toMatchObject({
      routeKey: "GET /failure",
      errorCount: 1,
      requestCount: 1,
    });
    expect(snapshot.unmatched).toMatchObject({
      requestCount: 1,
      statusCounts: { "404": 1 },
    });
  });

  it("excludes configured patterns and NodePulse self-traffic", async () => {
    const { app, store } = createHarness({
      excludePaths: ["/health/:scope", /^\/internal/],
    });
    app.get("/health/:scope", (_request, response) => response.send("ok"));
    app.get("/internal/status", (_request, response) => response.send("ok"));
    app.get("/nodepulse", (_request, response) => response.send("dashboard"));
    app.get("/nodepulse/metrics.json", (_request, response) =>
      response.json({}),
    );

    await request(app).get("/health/live").expect(200);
    await request(app).get("/internal/status").expect(200);
    await request(app).get("/nodepulse").expect(200);
    await request(app).get("/nodepulse/metrics.json").expect(200);

    expect(store.query(60).routes).toEqual([]);
  });

  it("records close-before-finish once as an abort", () => {
    const config = resolveConfig();
    const store = new RollingMetricsStore(config, () => 0);
    const response = new FakeResponse();
    const expressRequest = {
      path: "/jobs/123",
      method: "GET",
      baseUrl: "",
      route: { path: "/jobs/:id" },
    } as Request;
    const middleware = createInstrumentationMiddleware(config, store, () => 10);

    middleware(
      expressRequest,
      response as unknown as Response,
      () => undefined,
    );
    response.emit("close");
    response.emit("finish");

    expect(store.query(60).routes[0]).toMatchObject({
      requestCount: 1,
      completedCount: 0,
      abortedCount: 1,
      errorCount: 0,
      averageResponseTimeMs: null,
    });
  });

  it("never lets recorder failures escape into the host response", () => {
    const config = resolveConfig();
    const recorder: MetricsRecorder = {
      recordCompleted: () => {
        throw new Error("store unavailable");
      },
      recordAborted: () => {
        throw new Error("store unavailable");
      },
      recordUnmatched: () => {
        throw new Error("store unavailable");
      },
    };
    const response = new FakeResponse();
    const expressRequest = {
      path: "/safe",
      method: "GET",
      baseUrl: "",
      route: { path: "/safe" },
    } as Request;
    const middleware = createInstrumentationMiddleware(
      config,
      recorder,
      () => 10,
    );

    expect(() => {
      middleware(
        expressRequest,
        response as unknown as Response,
        () => undefined,
      );
      response.emit("finish");
    }).not.toThrow();
  });
});

describe("normalizeRoutePath", () => {
  it("supports root routes, arrays, and regular expressions deterministically", () => {
    expect(
      normalizeRoutePath({ baseUrl: "/api", route: { path: "/" } } as Request),
    ).toBe("/api");
    expect(
      normalizeRoutePath({
        baseUrl: "",
        route: { path: ["/a", "/b"] },
      } as Request),
    ).toBe("/{/a|/b}");
    expect(
      normalizeRoutePath({
        baseUrl: "",
        route: { path: /^\/items\/\d+$/ },
      } as Request),
    ).toBe("/{regex:/^\\/items\\/\\d+$/}");
    expect(normalizeRoutePath({ baseUrl: "" } as Request)).toBeNull();
  });

  it("normalizes common mounted identifier shapes without changing static segments", () => {
    expect(
      normalizeRoutePath({
        baseUrl:
          "/tenants/507f1f77bcf86cd799439011/releases/550e8400-e29b-41d4-a716-446655440000",
        params: {},
        route: { path: "/status" },
      } as Request),
    ).toBe("/tenants/:mountParam1/releases/:mountParam2/status");
    expect(
      normalizeRoutePath({
        baseUrl: "/api/v2",
        params: {},
        route: { path: "/status" },
      } as Request),
    ).toBe("/api/v2/status");
  });
});

class FakeResponse extends EventEmitter {
  statusCode = 200;
}
