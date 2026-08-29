import type { ResolvedNodePulseConfig } from "../config.js";
import { LatencyHistogram } from "../metrics/histogram.js";

export const OTHER_ROUTE_KEY = "other";
export const UNMATCHED_ROUTE_KEY = "unmatched";
export const MAX_UNMATCHED_STATUS_CODES = 32;

interface RouteBucket {
  readonly startTimeMs: number;
  requestCount: number;
  errorCount: number;
  abortedCount: number;
  responseTimeSum: number;
  responseTimeMin: number | null;
  responseTimeMax: number | null;
  readonly histogram: LatencyHistogram;
}

interface UnmatchedBucket {
  readonly startTimeMs: number;
  requestCount: number;
  readonly statusCounts: Map<number | "other", number>;
}

interface RouteSeries {
  readonly routeKey: string;
  readonly buckets: Map<number, RouteBucket>;
}

export interface RouteMetrics {
  readonly routeKey: string;
  readonly requestCount: number;
  readonly completedCount: number;
  readonly errorCount: number;
  readonly abortedCount: number;
  readonly requestsPerSecond: number;
  readonly averageResponseTimeMs: number | null;
  readonly minimumResponseTimeMs: number | null;
  readonly maximumResponseTimeMs: number | null;
  readonly errorRate: number;
  readonly p50ResponseTimeMs: number | null;
  readonly p95ResponseTimeMs: number | null;
  readonly p99ResponseTimeMs: number | null;
  readonly recentRequestCounts: readonly number[];
}

export interface UnmatchedMetrics {
  readonly routeKey: typeof UNMATCHED_ROUTE_KEY;
  readonly requestCount: number;
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly recentRequestCounts: readonly number[];
}

export interface MetricsSnapshot {
  readonly generatedAtMs: number;
  readonly windowSeconds: number;
  readonly routes: readonly RouteMetrics[];
  readonly unmatched: UnmatchedMetrics;
}

type Clock = () => number;

export class RollingMetricsStore {
  readonly #config: ResolvedNodePulseConfig;
  readonly #clock: Clock;
  readonly #bucketSizeMs: number;
  readonly #retentionSeconds: number;
  readonly #routes = new Map<string, RouteSeries>();
  readonly #other: RouteSeries = {
    routeKey: OTHER_ROUTE_KEY,
    buckets: new Map(),
  };
  readonly #unmatchedBuckets = new Map<number, UnmatchedBucket>();

  constructor(config: ResolvedNodePulseConfig, clock: Clock = Date.now) {
    this.#config = config;
    this.#clock = clock;
    this.#bucketSizeMs = config.bucketSizeSeconds * 1_000;
    this.#retentionSeconds = config.retentionMinutes * 60;
  }

  recordCompleted(
    routeKey: string,
    statusCode: number,
    responseTimeMs: number,
  ): void {
    validateRouteKey(routeKey);
    validateStatusCode(statusCode);
    validateResponseTime(responseTimeMs);

    const nowMs = this.#now();
    const bucketStartMs = this.#bucketStart(nowMs);
    const series = this.#routeSeries(routeKey, bucketStartMs);
    const bucket = this.#routeBucket(series, bucketStartMs);

    bucket.requestCount += 1;
    if (statusCode >= this.#config.errorStatusThreshold) {
      bucket.errorCount += 1;
    }
    bucket.responseTimeSum += responseTimeMs;
    bucket.responseTimeMin = Math.min(
      bucket.responseTimeMin ?? responseTimeMs,
      responseTimeMs,
    );
    bucket.responseTimeMax = Math.max(
      bucket.responseTimeMax ?? responseTimeMs,
      responseTimeMs,
    );
    bucket.histogram.record(responseTimeMs);
  }

  recordAborted(routeKey: string): void {
    validateRouteKey(routeKey);

    const nowMs = this.#now();
    const bucketStartMs = this.#bucketStart(nowMs);
    const series = this.#routeSeries(routeKey, bucketStartMs);
    const bucket = this.#routeBucket(series, bucketStartMs);

    bucket.requestCount += 1;
    bucket.abortedCount += 1;
  }

  recordUnmatched(statusCode: number): void {
    validateStatusCode(statusCode);

    const nowMs = this.#now();
    const bucketStartMs = this.#bucketStart(nowMs);
    this.#pruneBuckets(this.#unmatchedBuckets, bucketStartMs);

    let bucket = this.#unmatchedBuckets.get(bucketStartMs);
    if (bucket === undefined) {
      bucket = {
        startTimeMs: bucketStartMs,
        requestCount: 0,
        statusCounts: new Map(),
      };
      this.#unmatchedBuckets.set(bucketStartMs, bucket);
    }

    bucket.requestCount += 1;
    const statusKey = this.#unmatchedStatusKey(bucket, statusCode);
    bucket.statusCounts.set(
      statusKey,
      (bucket.statusCounts.get(statusKey) ?? 0) + 1,
    );
  }

  query(windowSeconds = this.#retentionSeconds): MetricsSnapshot {
    this.#validateWindow(windowSeconds);

    const nowMs = this.#now();
    const currentBucketStartMs = this.#bucketStart(nowMs);
    const includedBucketCount = windowSeconds / this.#config.bucketSizeSeconds;
    const earliestBucketStartMs =
      currentBucketStartMs - (includedBucketCount - 1) * this.#bucketSizeMs;

    this.#pruneAll(currentBucketStartMs);

    const routes = [...this.#routes.values(), this.#other]
      .map((series) =>
        this.#aggregateRoute(
          series,
          earliestBucketStartMs,
          currentBucketStartMs,
          windowSeconds,
        ),
      )
      .filter((metrics): metrics is RouteMetrics => metrics !== null)
      .sort((left, right) => left.routeKey.localeCompare(right.routeKey));

    return Object.freeze({
      generatedAtMs: nowMs,
      windowSeconds,
      routes: Object.freeze(routes),
      unmatched: this.#aggregateUnmatched(
        earliestBucketStartMs,
        currentBucketStartMs,
        includedBucketCount,
      ),
    });
  }

  #routeSeries(routeKey: string, currentBucketStartMs: number): RouteSeries {
    const existing = this.#routes.get(routeKey);
    if (existing !== undefined) {
      return existing;
    }

    this.#pruneRoutes(currentBucketStartMs);
    if (this.#routes.size >= this.#config.maxTrackedRoutes) {
      return this.#other;
    }

    const created: RouteSeries = { routeKey, buckets: new Map() };
    this.#routes.set(routeKey, created);
    return created;
  }

  #routeBucket(series: RouteSeries, bucketStartMs: number): RouteBucket {
    this.#pruneBuckets(series.buckets, bucketStartMs);

    let bucket = series.buckets.get(bucketStartMs);
    if (bucket === undefined) {
      bucket = {
        startTimeMs: bucketStartMs,
        requestCount: 0,
        errorCount: 0,
        abortedCount: 0,
        responseTimeSum: 0,
        responseTimeMin: null,
        responseTimeMax: null,
        histogram: new LatencyHistogram(),
      };
      series.buckets.set(bucketStartMs, bucket);
    }
    return bucket;
  }

  #aggregateRoute(
    series: RouteSeries,
    earliestBucketStartMs: number,
    currentBucketStartMs: number,
    windowSeconds: number,
  ): RouteMetrics | null {
    const histogram = new LatencyHistogram();
    const recentRequestCounts: number[] = [];
    let requestCount = 0;
    let completedCount = 0;
    let errorCount = 0;
    let abortedCount = 0;
    let responseTimeSum = 0;
    let responseTimeMin: number | null = null;
    let responseTimeMax: number | null = null;

    for (
      let bucketStartMs = earliestBucketStartMs;
      bucketStartMs <= currentBucketStartMs;
      bucketStartMs += this.#bucketSizeMs
    ) {
      const bucket = series.buckets.get(bucketStartMs);
      recentRequestCounts.push(bucket?.requestCount ?? 0);
      if (bucket === undefined) {
        continue;
      }

      const snapshot = bucket.histogram.snapshot();
      requestCount += bucket.requestCount;
      completedCount += snapshot.count;
      errorCount += bucket.errorCount;
      abortedCount += bucket.abortedCount;
      responseTimeSum += bucket.responseTimeSum;
      responseTimeMin = minimum(responseTimeMin, bucket.responseTimeMin);
      responseTimeMax = maximum(responseTimeMax, bucket.responseTimeMax);
      histogram.merge(snapshot);
    }

    if (requestCount === 0) {
      return null;
    }

    return Object.freeze({
      routeKey: series.routeKey,
      requestCount,
      completedCount,
      errorCount,
      abortedCount,
      requestsPerSecond: requestCount / windowSeconds,
      averageResponseTimeMs:
        completedCount === 0 ? null : responseTimeSum / completedCount,
      minimumResponseTimeMs: responseTimeMin,
      maximumResponseTimeMs: responseTimeMax,
      errorRate: completedCount === 0 ? 0 : errorCount / completedCount,
      p50ResponseTimeMs: histogram.percentile(0.5),
      p95ResponseTimeMs: histogram.percentile(0.95),
      p99ResponseTimeMs: histogram.percentile(0.99),
      recentRequestCounts: Object.freeze(recentRequestCounts),
    });
  }

  #aggregateUnmatched(
    earliestBucketStartMs: number,
    currentBucketStartMs: number,
    includedBucketCount: number,
  ): UnmatchedMetrics {
    const statusCounts = new Map<number | "other", number>();
    const recentRequestCounts: number[] = [];
    let requestCount = 0;

    for (
      let bucketStartMs = earliestBucketStartMs;
      bucketStartMs <= currentBucketStartMs;
      bucketStartMs += this.#bucketSizeMs
    ) {
      const bucket = this.#unmatchedBuckets.get(bucketStartMs);
      recentRequestCounts.push(bucket?.requestCount ?? 0);
      if (bucket === undefined) {
        continue;
      }
      requestCount += bucket.requestCount;
      for (const [status, count] of bucket.statusCounts) {
        const statusKey = aggregateStatusKey(statusCounts, status);
        statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + count);
      }
    }

    while (recentRequestCounts.length < includedBucketCount) {
      recentRequestCounts.unshift(0);
    }

    return Object.freeze({
      routeKey: UNMATCHED_ROUTE_KEY,
      requestCount,
      statusCounts: Object.freeze(
        Object.fromEntries(
          [...statusCounts.entries()]
            .sort(([left], [right]) =>
              String(left).localeCompare(String(right)),
            )
            .map(([status, count]) => [String(status), count]),
        ),
      ),
      recentRequestCounts: Object.freeze(recentRequestCounts),
    });
  }

  #unmatchedStatusKey(
    bucket: UnmatchedBucket,
    statusCode: number,
  ): number | "other" {
    if (bucket.statusCounts.has(statusCode)) {
      return statusCode;
    }
    const distinctStatuses = [...bucket.statusCounts.keys()].filter(
      (key) => key !== "other",
    ).length;
    return distinctStatuses < MAX_UNMATCHED_STATUS_CODES ? statusCode : "other";
  }

  #pruneAll(currentBucketStartMs: number): void {
    this.#pruneRoutes(currentBucketStartMs);
    this.#pruneBuckets(this.#other.buckets, currentBucketStartMs);
    this.#pruneBuckets(this.#unmatchedBuckets, currentBucketStartMs);
  }

  #pruneRoutes(currentBucketStartMs: number): void {
    for (const [routeKey, series] of this.#routes) {
      this.#pruneBuckets(series.buckets, currentBucketStartMs);
      if (series.buckets.size === 0) {
        this.#routes.delete(routeKey);
      }
    }
  }

  #pruneBuckets<T extends { readonly startTimeMs: number }>(
    buckets: Map<number, T>,
    currentBucketStartMs: number,
  ): void {
    const earliestRetainedStartMs =
      currentBucketStartMs -
      (this.#config.bucketCount - 1) * this.#bucketSizeMs;
    for (const [startTimeMs] of buckets) {
      if (startTimeMs < earliestRetainedStartMs) {
        buckets.delete(startTimeMs);
      }
    }
  }

  #validateWindow(windowSeconds: number): void {
    if (!Number.isSafeInteger(windowSeconds) || windowSeconds <= 0) {
      throw new RangeError("windowSeconds must be a positive integer");
    }
    if (windowSeconds > this.#retentionSeconds) {
      throw new RangeError("windowSeconds cannot exceed the retention window");
    }
    if (windowSeconds % this.#config.bucketSizeSeconds !== 0) {
      throw new RangeError(
        "windowSeconds must be divisible by bucketSizeSeconds",
      );
    }
  }

  #bucketStart(timestampMs: number): number {
    return Math.floor(timestampMs / this.#bucketSizeMs) * this.#bucketSizeMs;
  }

  #now(): number {
    const timestampMs = this.#clock();
    if (!Number.isFinite(timestampMs) || timestampMs < 0) {
      throw new RangeError("clock must return a non-negative finite timestamp");
    }
    return timestampMs;
  }
}

function validateRouteKey(routeKey: string): void {
  if (routeKey.trim().length === 0) {
    throw new TypeError("routeKey must not be empty");
  }
}

function validateStatusCode(statusCode: number): void {
  if (
    !Number.isSafeInteger(statusCode) ||
    statusCode < 100 ||
    statusCode > 999
  ) {
    throw new RangeError("statusCode must be an integer from 100 through 999");
  }
}

function validateResponseTime(responseTimeMs: number): void {
  if (!Number.isFinite(responseTimeMs) || responseTimeMs < 0) {
    throw new RangeError("responseTimeMs must be a non-negative finite number");
  }
}

function minimum(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

function maximum(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

function aggregateStatusKey(
  statusCounts: ReadonlyMap<number | "other", number>,
  status: number | "other",
): number | "other" {
  if (status === "other" || statusCounts.has(status)) {
    return status;
  }
  const distinctStatuses = [...statusCounts.keys()].filter(
    (key) => key !== "other",
  ).length;
  return distinctStatuses < MAX_UNMATCHED_STATUS_CODES ? status : "other";
}
