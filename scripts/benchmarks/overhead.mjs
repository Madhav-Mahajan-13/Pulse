import { createServer } from "node:http";
import { cpus, platform, release } from "node:os";
import { performance } from "node:perf_hooks";

import express from "express";

import nodepulse from "../../dist/index.js";

const options = readOptions(process.argv.slice(2));
const baseline = await startServer(false);
const instrumented = await startServer(true);

try {
  await runLoad(baseline.url, 800, options.concurrency);
  await runLoad(instrumented.url, 800, options.concurrency);

  const overheadSamples = [];
  const rounds = [];
  for (let round = 0; round < 3; round += 1) {
    const order =
      round % 2 === 0 ? [baseline, instrumented] : [instrumented, baseline];
    const results = new Map();
    for (const target of order) {
      results.set(
        target.name,
        await runLoad(target.url, options.requests, options.concurrency),
      );
    }
    const baselineResult = results.get("baseline");
    const instrumentedResult = results.get("instrumented");
    const overheadMs = instrumentedResult.p95Ms - baselineResult.p95Ms;
    overheadSamples.push(overheadMs);
    rounds.push({
      baseline: baselineResult,
      instrumented: instrumentedResult,
      overheadMs,
    });
  }

  const medianOverheadMs = median(overheadSamples);
  const measuredOverheadMs = Math.max(0, medianOverheadMs);
  const result = {
    passed: measuredOverheadMs < options.thresholdMs,
    thresholdMs: options.thresholdMs,
    measuredP95OverheadMs: measuredOverheadMs,
    rawMedianDifferenceMs: medianOverheadMs,
    requestsPerRound: options.requests,
    concurrency: options.concurrency,
    rounds,
    environment: environmentDetails(),
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} finally {
  await Promise.all([baseline.close(), instrumented.close()]);
}

async function startServer(withNodePulse) {
  const app = express();
  if (withNodePulse) {
    app.use(nodepulse({ retentionMinutes: 1, maxTrackedRoutes: 10 }));
  }
  app.get("/benchmark/:id", (_request, response) => response.status(204).end());
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Missing benchmark server port");
  }
  return {
    name: withNodePulse ? "instrumented" : "baseline",
    url: `http://127.0.0.1:${address.port}/benchmark/123`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function runLoad(url, requestCount, concurrency) {
  const durations = [];
  let nextRequest = 0;
  const startedAt = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (nextRequest < requestCount) {
        nextRequest += 1;
        const requestStartedAt = performance.now();
        const response = await fetch(url);
        if (response.status !== 204) {
          throw new Error(`Unexpected benchmark status ${response.status}`);
        }
        await response.arrayBuffer();
        durations.push(performance.now() - requestStartedAt);
      }
    }),
  );
  const elapsedMs = performance.now() - startedAt;
  return {
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    requestsPerSecond: requestCount / (elapsedMs / 1_000),
  };
}

function percentile(values, quantile) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)];
}

function median(values) {
  return percentile(values, 0.5);
}

function readOptions(args) {
  const values = Object.fromEntries(
    args.map((argument) => {
      const [key, value] = argument.replace(/^--/, "").split("=");
      return [key, Number(value)];
    }),
  );
  return {
    requests: positiveInteger(values.requests ?? 4_000, "requests"),
    concurrency: positiveInteger(values.concurrency ?? 32, "concurrency"),
    thresholdMs: positiveNumber(values["threshold-ms"] ?? 1, "threshold-ms"),
  };
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function positiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be positive`);
  }
  return value;
}

function environmentDetails() {
  return {
    node: process.version,
    platform: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCpuCount: cpus().length,
  };
}
