import type { RequestHandler } from "express";

import { resolveConfig, type NodePulseConfig } from "./config.js";
import { createInstrumentationMiddleware } from "./instrumentation/express-middleware.js";
import { createPresentationMiddleware } from "./presentation/http-middleware.js";
import { RollingMetricsStore } from "./storage/rolling-store.js";

export default function nodepulse(
  options: NodePulseConfig = {},
): RequestHandler {
  const config = resolveConfig(options);
  const store = new RollingMetricsStore(config);
  const presentation = createPresentationMiddleware(config, store);
  const instrumentation = createInstrumentationMiddleware(config, store);

  return (request, response, next) => {
    presentation(request, response, (error?: unknown) => {
      if (error !== undefined && error !== null) {
        next(error);
        return;
      }
      instrumentation(request, response, next);
    });
  };
}
