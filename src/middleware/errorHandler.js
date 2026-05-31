// src/middleware/errorHandler.js
import { logger } from "../telemetry/logger.js";

export function errorHandler(err, req, res, _next) {
  logger.error("unhandled error", {
    "http.method": req.method,
    "http.route":  req.path,
    "error":       err.message,
    "stack":       err.stack,
  });
  res.status(err.status || 500).json({
    ok:    false,
    error: err.message || "Erro interno do servidor",
  });
}

export function notFound(req, res) {
  logger.warn("route not found", {
    "http.method": req.method,
    "http.route":  req.path,
  });
  res.status(404).json({
    ok:    false,
    error: `Rota não encontrada: ${req.method} ${req.path}`,
  });
}
