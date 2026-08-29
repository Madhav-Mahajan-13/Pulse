import { describe, expect, it } from "vitest";

import { resolveConfig } from "../src/config.js";

describe("resolveConfig", () => {
  it("applies the approved defaults", () => {
    expect(resolveConfig()).toMatchObject({
      retentionMinutes: 60,
      bucketSizeSeconds: 60,
      bucketCount: 60,
      dashboardPath: "/nodepulse",
      metricsJsonPath: "/nodepulse/metrics.json",
      errorStatusThreshold: 500,
      maxTrackedRoutes: 200,
      excludePaths: [],
    });
  });

  it("rejects retention windows that do not divide into whole buckets", () => {
    expect(() =>
      resolveConfig({ retentionMinutes: 1, bucketSizeSeconds: 7 }),
    ).toThrow(/evenly divisible/);
  });

  it.each([
    ["retentionMinutes", { retentionMinutes: 0 }],
    ["bucketSizeSeconds", { bucketSizeSeconds: -1 }],
    ["maxTrackedRoutes", { maxTrackedRoutes: 1.5 }],
  ])("rejects invalid %s values", (_name, input) => {
    expect(() => resolveConfig(input)).toThrow(/must be a positive/);
  });

  it("rejects error thresholds outside the HTTP error range", () => {
    expect(() => resolveConfig({ errorStatusThreshold: 399 })).toThrow(
      /400 through 599/,
    );
  });

  it("rejects relative endpoint paths", () => {
    expect(() => resolveConfig({ dashboardPath: "nodepulse" })).toThrow(
      /absolute path/,
    );
  });

  it("normalizes one trailing slash before comparing endpoint paths", () => {
    expect(() =>
      resolveConfig({
        dashboardPath: "/nodepulse/",
        metricsJsonPath: "/nodepulse",
      }),
    ).toThrow(/must be distinct/);
  });

  it("rejects stateful exclusion regular expressions", () => {
    expect(() => resolveConfig({ excludePaths: [/health/g] })).toThrow(
      /must not use the g or y flag/,
    );
  });

  it("rejects unsupported exclusion values", () => {
    expect(() =>
      resolveConfig({ excludePaths: [42 as unknown as string] }),
    ).toThrow(/string or RegExp/);
  });

  it("accepts exact strings and non-stateful regular expressions", () => {
    const config = resolveConfig({ excludePaths: ["/health", /^\/internal/] });

    expect(config.excludePaths).toHaveLength(2);
  });
});
