import { performance } from "node:perf_hooks";

import type { Request, RequestHandler } from "express";

import type { ResolvedNodePulseConfig } from "../config.js";
import { canonicalPath } from "../http/path.js";

interface ExpressRouteMetadata {
  readonly path?: unknown;
}

type RequestWithRoute = Omit<Request, "route"> & {
  readonly route?: ExpressRouteMetadata;
};
type DurationClock = () => number;

export interface MetricsRecorder {
  recordCompleted(
    routeKey: string,
    statusCode: number,
    responseTimeMs: number,
  ): void;
  recordAborted(routeKey: string): void;
  recordUnmatched(statusCode: number): void;
}

export function createInstrumentationMiddleware(
  config: ResolvedNodePulseConfig,
  recorder: MetricsRecorder,
  durationClock: DurationClock = () => performance.now(),
): RequestHandler {
  return (request, response, next) => {
    if (isSelfTraffic(request.path, config)) {
      next();
      return;
    }

    const startedAtMs = durationClock();
    let recorded = false;

    const cleanup = (): void => {
      response.off("finish", onFinish);
      response.off("close", onClose);
    };

    const record = (aborted: boolean): void => {
      if (recorded) {
        return;
      }
      recorded = true;
      cleanup();

      safelyRecord(() => {
        const normalizedPath = normalizeRoutePath(request);
        if (normalizedPath === null) {
          if (!aborted) {
            recorder.recordUnmatched(response.statusCode);
          }
          return;
        }
        if (isExcludedPath(normalizedPath, config)) {
          return;
        }

        const routeKey = `${request.method.toUpperCase()} ${normalizedPath}`;
        if (aborted) {
          recorder.recordAborted(routeKey);
          return;
        }

        const responseTimeMs = Math.max(0, durationClock() - startedAtMs);
        recorder.recordCompleted(routeKey, response.statusCode, responseTimeMs);
      });
    };

    function onFinish(): void {
      record(false);
    }

    function onClose(): void {
      record(true);
    }

    response.once("finish", onFinish);
    response.once("close", onClose);
    next();
  };
}

export function normalizeRoutePath(request: RequestWithRoute): string | null {
  const routePattern = serializeRoutePattern(request.route?.path);
  if (routePattern === null) {
    return null;
  }

  const basePath = canonicalPath(request.baseUrl || "/");
  if (routePattern === "/") {
    return basePath;
  }
  if (basePath === "/") {
    return canonicalPath(routePattern);
  }
  return canonicalPath(`${basePath}/${routePattern.replace(/^\/+/, "")}`);
}

function serializeRoutePattern(pattern: unknown): string | null {
  if (typeof pattern === "string") {
    return pattern;
  }
  if (pattern instanceof RegExp) {
    return `{regex:${pattern.toString()}}`;
  }
  if (Array.isArray(pattern) && pattern.length > 0) {
    const alternatives = pattern.map(serializeRoutePattern);
    if (alternatives.some((value) => value === null)) {
      return null;
    }
    return `{${alternatives.join("|")}}`;
  }
  return null;
}

function isSelfTraffic(path: string, config: ResolvedNodePulseConfig): boolean {
  const canonicalRequestPath = canonicalPath(path);
  return (
    canonicalRequestPath === config.dashboardPath ||
    canonicalRequestPath === config.metricsJsonPath
  );
}

function isExcludedPath(
  path: string,
  config: ResolvedNodePulseConfig,
): boolean {
  if (path === config.dashboardPath || path === config.metricsJsonPath) {
    return true;
  }
  return config.excludePaths.some((excludedPath) =>
    typeof excludedPath === "string"
      ? excludedPath === path
      : excludedPath.test(path),
  );
}

function safelyRecord(action: () => void): void {
  try {
    action();
  } catch {
    // Monitoring must never break the host application's response lifecycle.
  }
}
