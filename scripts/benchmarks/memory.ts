import { cpus, platform, release } from "node:os";

import { resolveConfig } from "../../src/config.js";
import { RollingMetricsStore } from "../../src/storage/rolling-store.js";

interface Profile {
  readonly retentionMinutes: number;
  readonly simulatedMinutes: number;
  readonly requestsPerSecond: number;
  readonly routeCount: number;
  readonly maximumPlateauGrowthBytes: number;
}

const profiles: Readonly<Record<string, Profile>> = {
  smoke: {
    retentionMinutes: 5,
    simulatedMinutes: 15,
    requestsPerSecond: 500,
    routeCount: 50,
    maximumPlateauGrowthBytes: 5 * 1024 * 1024,
  },
  release: {
    retentionMinutes: 60,
    simulatedMinutes: 120,
    requestsPerSecond: 500,
    routeCount: 50,
    maximumPlateauGrowthBytes: 10 * 1024 * 1024,
  },
};

const profileName = readProfileName(process.argv.slice(2));
const profile = profiles[profileName];
if (profile === undefined) throw new Error(`Unknown profile: ${profileName}`);
if (globalThis.gc === undefined) {
  throw new Error("Run this benchmark with garbage collection exposed");
}

let nowMs = 0;
const config = resolveConfig({
  retentionMinutes: profile.retentionMinutes,
  bucketSizeSeconds: 60,
  maxTrackedRoutes: profile.routeCount,
});
const store = new RollingMetricsStore(config, () => nowMs);
const samples: Array<{ minute: number; heapUsedBytes: number }> = [];
const totalSeconds = profile.simulatedMinutes * 60;

for (let second = 0; second < totalSeconds; second += 1) {
  nowMs = second * 1_000;
  for (
    let requestIndex = 0;
    requestIndex < profile.requestsPerSecond;
    requestIndex += 1
  ) {
    const routeIndex = requestIndex % profile.routeCount;
    const latencyMs = 2 + ((second + requestIndex) % 9_998);
    const statusCode = requestIndex % 100 === 0 ? 500 : 200;
    store.recordCompleted(
      `GET /benchmark/${routeIndex}`,
      statusCode,
      latencyMs,
    );
  }
  if ((second + 1) % 60 === 0) {
    collectGarbage();
    samples.push({
      minute: (second + 1) / 60,
      heapUsedBytes: process.memoryUsage().heapUsed,
    });
  }
}

const plateauSamples = samples.filter(
  ({ minute }) => minute >= profile.retentionMinutes,
);
const firstPlateau = plateauSamples[0]?.heapUsedBytes ?? 0;
const peakPlateau = Math.max(
  ...plateauSamples.map(({ heapUsedBytes }) => heapUsedBytes),
);
const plateauGrowthBytes = Math.max(0, peakPlateau - firstPlateau);
const snapshot = store.query();
const result = {
  passed:
    snapshot.routes.length === profile.routeCount &&
    plateauGrowthBytes <= profile.maximumPlateauGrowthBytes,
  profile: profileName,
  simulatedRequests: totalSeconds * profile.requestsPerSecond,
  retainedRoutes: snapshot.routes.length,
  expectedRoutes: profile.routeCount,
  firstPlateauHeapBytes: firstPlateau,
  peakPlateauHeapBytes: peakPlateau,
  plateauGrowthBytes,
  maximumPlateauGrowthBytes: profile.maximumPlateauGrowthBytes,
  samples,
  environment: {
    node: process.version,
    platform: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCpuCount: cpus().length,
  },
};

console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;

function collectGarbage(): void {
  globalThis.gc?.();
  globalThis.gc?.();
}

function readProfileName(args: readonly string[]): string {
  const profileArgument = args.find((argument) =>
    argument.startsWith("--profile="),
  );
  return profileArgument?.slice("--profile=".length) ?? "smoke";
}
