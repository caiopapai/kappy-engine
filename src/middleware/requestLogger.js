// src/middleware/requestLogger.js
// Middleware Express que emite um log OTLP por cada request/response.
// Não usa auto-instrumentação — cria os registos manualmente.

import { logger } from "../telemetry/logger.js";

export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  const { method, path, query, ip } = req;

  res.on("finish", () => {
    const duration  = Date.now() - startedAt;
    const status    = res.statusCode;
    const isError   = status >= 500;
    const isWarn    = status >= 400 && status < 500;

    const attributes = {
      "http.method":      method,
      "http.route":       path,
      "http.status_code": status,
      "http.duration_ms": duration,
      "net.peer.ip":      ip,
      ...(Object.keys(query).length > 0 && { "http.query": JSON.stringify(query) }),
    };

    const body = `${method} ${path} → ${status} (${duration}ms)`;

    if (isError) {
      logger.error(body, attributes);
    } else if (isWarn) {
      logger.warn(body, attributes);
    } else {
      logger.info(body, attributes);
    }
  });

  next();
}
