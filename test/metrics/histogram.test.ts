import { describe, expect, it } from "vitest";

import {
  LATENCY_BUCKET_UPPER_BOUNDS_MS,
  LatencyHistogram,
} from "../../src/metrics/histogram.js";

describe("LatencyHistogram", () => {
  it("places observations into the twelve approved buckets", () => {
    const histogram = new LatencyHistogram();
    const observations = [
      0, 5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000,
    ];

    observations.forEach((value) => histogram.record(value));

    expect(histogram.snapshot().counts).toEqual(Array(12).fill(1));
    expect(LATENCY_BUCKET_UPPER_BOUNDS_MS).toHaveLength(11);
  });

  it("returns null when no observations have been recorded", () => {
    expect(new LatencyHistogram().percentile(0.95)).toBeNull();
  });

  it("interpolates within a finite bucket", () => {
    const histogram = new LatencyHistogram();
    [12, 14, 20, 24].forEach((value) => histogram.record(value));

    expect(histogram.percentile(0.5)).toBeCloseTo(17.5);
  });

  it("uses the observed maximum as the overflow bucket upper bound", () => {
    const histogram = new LatencyHistogram();
    [11_000, 12_000, 15_000, 20_000].forEach((value) =>
      histogram.record(value),
    );

    expect(histogram.percentile(0.5)).toBe(15_000);
    expect(histogram.percentile(1)).toBe(20_000);
  });

  it("rejects invalid observations and quantiles", () => {
    const histogram = new LatencyHistogram();

    expect(() => histogram.record(-1)).toThrow(/non-negative/);
    expect(() => histogram.record(Number.NaN)).toThrow(/finite/);
    expect(() => histogram.percentile(1.01)).toThrow(/between 0 and 1/);
  });
});
