import type { Request, RequestHandler, Response } from "express";

import type { ResolvedNodePulseConfig } from "../config.js";
import { canonicalPath } from "../http/path.js";
import type { MetricsSnapshot } from "../storage/rolling-store.js";
import { renderDashboard } from "./dashboard.js";

export const METRICS_SCHEMA_VERSION = 2;

export interface MetricsReader {
  query(windowSeconds?: number): MetricsSnapshot;
}

export function createPresentationMiddleware(
  config: ResolvedNodePulseConfig,
  reader: MetricsReader,
): RequestHandler {
  const retentionSeconds = config.retentionMinutes * 60;
  const dashboard = renderDashboard({
    metricsJsonPath: config.metricsJsonPath,
    defaultWindowSeconds: retentionSeconds,
  });

  return (request, response, next) => {
    const requestPath = canonicalPath(request.path);
    if (requestPath === config.dashboardPath) {
      if (!isReadableMethod(request)) {
        methodNotAllowed(response);
        return;
      }
      setDashboardSecurityHeaders(response);
      response.status(200).type("html").send(dashboard);
      return;
    }
    if (requestPath === config.metricsJsonPath) {
      if (!isReadableMethod(request)) {
        methodNotAllowed(response);
        return;
      }
      serveMetrics(request, response, reader, retentionSeconds);
      return;
    }
    next();
  };
}

function serveMetrics(
  request: Request,
  response: Response,
  reader: MetricsReader,
  defaultWindowSeconds: number,
): void {
  try {
    const windowSeconds = readWindowSeconds(request, defaultWindowSeconds);
    const snapshot = reader.query(windowSeconds);
    response.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response
      .status(200)
      .json({ schemaVersion: METRICS_SCHEMA_VERSION, ...snapshot });
  } catch (error) {
    response.status(400).json({
      error: {
        code: "INVALID_WINDOW",
        message:
          error instanceof Error ? error.message : "Invalid metrics window",
      },
    });
  }
}

function readWindowSeconds(request: Request, defaultValue: number): number {
  const value = request.query.windowSeconds;
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new TypeError("windowSeconds must be a positive integer");
  }
  return Number(value);
}

function isReadableMethod(request: Request): boolean {
  return request.method === "GET" || request.method === "HEAD";
}

function methodNotAllowed(response: Response): void {
  response.set("Allow", "GET, HEAD").sendStatus(405);
}

function setDashboardSecurityHeaders(response: Response): void {
  response.set({
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
}
