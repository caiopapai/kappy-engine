// src/middleware/errorHandler.js

export function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({
    ok:    false,
    error: err.message || "Erro interno do servidor",
  });
}

export function notFound(req, res) {
  res.status(404).json({
    ok:    false,
    error: `Rota não encontrada: ${req.method} ${req.path}`,
  });
}
