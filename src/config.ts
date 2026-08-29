import { canonicalPath } from "./http/path.js";

const DEFAULTS = {
  retentionMinutes: 60,
  bucketSizeSeconds: 60,
  dashboardPath: "/nodepulse",
  metricsJsonPath: "/nodepulse/metrics.json",
  errorStatusThreshold: 500,
  maxTrackedRoutes: 200,
} as const;

export interface NodePulseConfig {
  retentionMinutes?: number;
  bucketSizeSeconds?: number;
  dashboardPath?: string;
  metricsJsonPath?: string;
  errorStatusThreshold?: number;
  maxTrackedRoutes?: number;
  excludePaths?: readonly (string | RegExp)[];
}

export interface ResolvedNodePulseConfig {
  readonly retentionMinutes: number;
  readonly bucketSizeSeconds: number;
  readonly bucketCount: number;
  readonly dashboardPath: string;
  readonly metricsJsonPath: string;
  readonly errorStatusThreshold: number;
  readonly maxTrackedRoutes: number;
  readonly excludePaths: readonly (string | RegExp)[];
}

export function resolveConfig(
  config: NodePulseConfig = {},
): ResolvedNodePulseConfig {
  const retentionMinutes = config.retentionMinutes ?? DEFAULTS.retentionMinutes;
  const bucketSizeSeconds =
    config.bucketSizeSeconds ?? DEFAULTS.bucketSizeSeconds;
  const dashboardPath = validatePath(
    "dashboardPath",
    config.dashboardPath ?? DEFAULTS.dashboardPath,
  );
  const metricsJsonPath = validatePath(
    "metricsJsonPath",
    config.metricsJsonPath ?? DEFAULTS.metricsJsonPath,
  );
  const errorStatusThreshold =
    config.errorStatusThreshold ?? DEFAULTS.errorStatusThreshold;
  const maxTrackedRoutes = config.maxTrackedRoutes ?? DEFAULTS.maxTrackedRoutes;
  const excludePaths = validateExcludePaths(config.excludePaths ?? []);

  requirePositiveFinite("retentionMinutes", retentionMinutes);
  requirePositiveInteger("bucketSizeSeconds", bucketSizeSeconds);
  requirePositiveInteger("maxTrackedRoutes", maxTrackedRoutes);
  requireHttpStatus("errorStatusThreshold", errorStatusThreshold);

  const retentionSeconds = retentionMinutes * 60;
  if (!Number.isSafeInteger(retentionSeconds)) {
    throw new TypeError(
      "retentionMinutes must resolve to a whole number of seconds",
    );
  }
  if (retentionSeconds % bucketSizeSeconds !== 0) {
    throw new RangeError(
      "retentionMinutes × 60 must be evenly divisible by bucketSizeSeconds",
    );
  }
  if (dashboardPath === metricsJsonPath) {
    throw new RangeError("dashboardPath and metricsJsonPath must be distinct");
  }

  return Object.freeze({
    retentionMinutes,
    bucketSizeSeconds,
    bucketCount: retentionSeconds / bucketSizeSeconds,
    dashboardPath,
    metricsJsonPath,
    errorStatusThreshold,
    maxTrackedRoutes,
    excludePaths: Object.freeze(excludePaths),
  });
}

function requirePositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function requirePositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function requireHttpStatus(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 400 || value > 599) {
    throw new RangeError(`${name} must be an integer from 400 through 599`);
  }
}

function validatePath(name: string, value: string): string {
  if (!value.startsWith("/") || value.includes("?") || value.includes("#")) {
    throw new TypeError(
      `${name} must be an absolute path without a query or fragment`,
    );
  }
  return canonicalPath(value);
}

function validateExcludePaths(
  paths: readonly (string | RegExp)[],
): (string | RegExp)[] {
  return paths.map((path, index) => {
    if (typeof path === "string") {
      return validatePath(`excludePaths[${index}]`, path);
    }
    if (!(path instanceof RegExp)) {
      throw new TypeError(`excludePaths[${index}] must be a string or RegExp`);
    }
    if (path.global || path.sticky) {
      throw new TypeError(
        `excludePaths[${index}] must not use the g or y flag`,
      );
    }
    return path;
  });
}
