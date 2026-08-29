import { describe, expect, it } from "vitest";

import { resolveConfig } from "../../src/config.js";
import {
  MAX_UNMATCHED_STATUS_CODES,
  OTHER_ROUTE_KEY,
  RollingMetricsStore,
} from "../../src/storage/rolling-store.js";

function createStore(
  options: {
    retentionMinutes?: number;
    maxTrackedRoutes?: number;
  } = {},
) {
  let nowMs = 0;
  const config = resolveConfig({
    retentionMinutes: options.retentionMinutes ?? 3,
    bucketSizeSeconds: 60,
    maxTrackedRoutes: options.maxTrackedRoutes ?? 2,
  });
  const store = new RollingMetricsStore(config, () => nowMs);

  return {
    store,
    setNow: (value: number) => {
      nowMs = value;
    },
  };
}

describe("RollingMetricsStore", () => {
  it("aggregates completed and aborted requests without mixing aborts into latency", () => {
    const { store } = createStore();

    store.recordCompleted("GET /users/:id", 200, 20);
    store.recordCompleted("GET /users/:id", 500, 100);
    store.recordAborted("GET /users/:id");

    const route = store.query(60).routes[0];

    expect(route).toMatchObject({
      routeKey: "GET /users/:id",
      requestCount: 3,
      completedCount: 2,
      errorCount: 1,
      abortedCount: 1,
      requestsPerSecond: 3 / 60,
      averageResponseTimeMs: 60,
      minimumResponseTimeMs: 20,
      maximumResponseTimeMs: 100,
      errorRate: 0.5,
      recentRequestCounts: [3],
    });
    expect(route?.p95ResponseTimeMs).not.toBeNull();
  });

  it("aggregates excess route keys under the reserved other route", () => {
    const { store } = createStore({ maxTrackedRoutes: 2 });

    store.recordCompleted("GET /a", 200, 10);
    store.recordCompleted("GET /b", 200, 20);
    store.recordCompleted("GET /c", 503, 30);

    const routes = store.query(60).routes;

    expect(routes.map(({ routeKey }) => routeKey)).toEqual([
      "GET /a",
      "GET /b",
      OTHER_ROUTE_KEY,
    ]);
    expect(
      routes.find(({ routeKey }) => routeKey === OTHER_ROUTE_KEY),
    ).toMatchObject({
      requestCount: 1,
      errorCount: 1,
    });
  });

  it("expires buckets outside the configured retention window", () => {
    const { store, setNow } = createStore({ retentionMinutes: 2 });
    store.recordCompleted("GET /old", 200, 10);

    setNow(120_000);

    expect(store.query().routes).toEqual([]);
  });

  it("reclaims a route-cardinality slot after its data expires", () => {
    const { store, setNow } = createStore({
      retentionMinutes: 1,
      maxTrackedRoutes: 1,
    });
    store.recordCompleted("GET /old", 200, 10);

    setNow(60_000);
    store.recordCompleted("GET /new", 200, 20);

    expect(store.query().routes.map(({ routeKey }) => routeKey)).toEqual([
      "GET /new",
    ]);
  });

  it("queries shorter bucket-aligned windows", () => {
    const { store, setNow } = createStore();
    store.recordCompleted("GET /health", 200, 5);

    setNow(60_000);
    store.recordCompleted("GET /health", 200, 10);

    expect(store.query(60).routes[0]?.requestCount).toBe(1);
    expect(store.query(120).routes[0]?.recentRequestCounts).toEqual([1, 1]);
  });

  it("keeps unmatched status cardinality bounded", () => {
    const { store } = createStore();

    for (let index = 0; index <= MAX_UNMATCHED_STATUS_CODES; index += 1) {
      store.recordUnmatched(400 + index);
    }
    store.recordUnmatched(400);

    const { unmatched } = store.query(60);

    expect(unmatched.requestCount).toBe(MAX_UNMATCHED_STATUS_CODES + 2);
    expect(Object.keys(unmatched.statusCounts)).toHaveLength(
      MAX_UNMATCHED_STATUS_CODES + 1,
    );
    expect(unmatched.statusCounts["400"]).toBe(2);
    expect(unmatched.statusCounts.other).toBe(1);
    expect(unmatched.recentRequestCounts).toEqual([
      MAX_UNMATCHED_STATUS_CODES + 2,
    ]);
  });

  it("keeps aggregated unmatched statuses bounded across multiple buckets", () => {
    const { store, setNow } = createStore();

    for (let index = 0; index < MAX_UNMATCHED_STATUS_CODES; index += 1) {
      store.recordUnmatched(400 + index);
    }
    setNow(60_000);
    for (let index = 0; index < MAX_UNMATCHED_STATUS_CODES; index += 1) {
      store.recordUnmatched(500 + index);
    }

    const { statusCounts } = store.query(120).unmatched;

    expect(Object.keys(statusCounts)).toHaveLength(
      MAX_UNMATCHED_STATUS_CODES + 1,
    );
    expect(statusCounts.other).toBe(MAX_UNMATCHED_STATUS_CODES);
  });

  it("merges histograms across buckets using the observed overflow maximum", () => {
    const { store, setNow } = createStore();
    store.recordCompleted("GET /slow", 200, 11_000);

    setNow(60_000);
    store.recordCompleted("GET /slow", 200, 20_000);

    const route = store.query(120).routes[0];

    expect(route?.p50ResponseTimeMs).toBe(15_000);
    expect(route?.maximumResponseTimeMs).toBe(20_000);
  });

  it("rejects invalid query windows and event values before recording", () => {
    const { store } = createStore();

    expect(() => store.query(30)).toThrow(/divisible/);
    expect(() => store.query(240)).toThrow(/retention/);
    expect(() => store.recordCompleted("", 200, 10)).toThrow(/routeKey/);
    expect(() => store.recordCompleted("GET /", 99, 10)).toThrow(/statusCode/);
    expect(() => store.recordCompleted("GET /", 200, -1)).toThrow(
      /responseTimeMs/,
    );
    expect(store.query().routes).toEqual([]);
  });
});
