import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import nodepulse from "../src/index.js";
import { renderDashboard } from "../src/presentation/dashboard.js";

afterEach(() => vi.useRealTimers());

describe("nodepulse public middleware", () => {
  it("records application traffic and exposes versioned JSON metrics", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const app = express();
    app.use(nodepulse({ retentionMinutes: 1 }));
    app.get("/users/:id", (_request, response) =>
      response.status(200).send("ok"),
    );

    await request(app).get("/users/123").expect(200);
    await request(app).get("/users/456").expect(200);
    vi.setSystemTime(60_000);
    const metrics = await request(app)
      .get("/nodepulse/metrics.json?windowSeconds=60")
      .expect("Content-Type", /json/)
      .expect(200);

    expect(metrics.body).toMatchObject({
      schemaVersion: 2,
      aggregationState: "ready",
      windowSeconds: 60,
      effectiveWindowSeconds: 60,
      bucketSizeSeconds: 60,
      routes: [
        {
          routeKey: "GET /users/:id",
          aggregationState: "ready",
          requestCount: 2,
          completedCount: 2,
          errorCount: 0,
          abortedCount: 0,
        },
      ],
      unmatched: {
        routeKey: "unmatched",
        aggregationState: "ready",
        requestCount: 0,
      },
    });
    expect(metrics.headers["cache-control"]).toBe("no-store");
  });

  it("does not include dashboard or JSON polling in application metrics", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const app = express();
    app.use(nodepulse({ retentionMinutes: 1 }));

    await request(app).get("/nodepulse").expect(200);
    await request(app).get("/nodepulse/metrics.json").expect(200);
    vi.setSystemTime(60_000);
    const metrics = await request(app)
      .get("/nodepulse/metrics.json")
      .expect(200);
    const body = metrics.body as {
      routes: unknown[];
      unmatched: { requestCount: number };
    };

    expect(body.routes).toEqual([]);
    expect(body.unmatched.requestCount).toBe(0);
  });

  it("serves a self-contained dashboard with defensive HTTP headers", async () => {
    const app = express();
    app.use(nodepulse());

    const response = await request(app)
      .get("/nodepulse")
      .expect("Content-Type", /html/)
      .expect(200);

    expect(response.text).toContain("NodePulse APM");
    expect(response.text).toContain("Recent request trend");
    expect(response.text).not.toMatch(/<script[^>]+src=/i);
    expect(response.text).not.toMatch(/<link[^>]+href=/i);
    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'none'",
    );
    expect(response.headers["x-frame-options"]).toBe("DENY");
  });

  it("supports custom endpoint paths and rejects invalid metric windows", async () => {
    const app = express();
    app.use(
      nodepulse({
        retentionMinutes: 2,
        dashboardPath: "/ops",
        metricsJsonPath: "/ops/data",
      }),
    );

    await request(app).get("/ops/").expect(200);
    const invalid = await request(app)
      .get("/ops/data?windowSeconds=30")
      .expect(400);

    expect(invalid.body).toEqual({
      error: {
        code: "INVALID_WINDOW",
        message: "windowSeconds must be divisible by bucketSizeSeconds",
      },
    });
  });

  it("owns its endpoints as read-only routes", async () => {
    const app = express();
    app.use(nodepulse());

    const response = await request(app).post("/nodepulse").expect(405);

    expect(response.headers.allow).toBe("GET, HEAD");
  });

  it("allows host authentication middleware to protect the dashboard prefix", async () => {
    const app = express();
    app.use("/nodepulse", (_request, response) => response.sendStatus(401));
    app.use(nodepulse());

    await request(app).get("/nodepulse").expect(401);
    await request(app).get("/nodepulse/metrics.json").expect(401);
  });

  it("fails immediately when public options are invalid", () => {
    expect(() => nodepulse({ retentionMinutes: 0 })).toThrow(
      /retentionMinutes must be a positive/,
    );
  });
});

describe("dashboard rendering", () => {
  it("escapes configuration before embedding it in inline JavaScript", () => {
    const dashboard = renderDashboard({
      metricsJsonPath: "/<img/src=x>",
      defaultWindowSeconds: 60,
    });

    expect(dashboard).not.toContain('"/<img/src=x>"');
    expect(dashboard).toContain("\\u003cimg/src=x>");
  });
});
