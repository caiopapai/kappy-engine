// src/server.js
import express        from "express";
import cors           from "cors";
import { config, validateConfig } from "./config/index.js";
import { logger }     from "./telemetry/logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import stocksRouter       from "./routes/stocks.js";
import sheetsRouter       from "./routes/sheets.js";
import transactionsRouter from "./routes/transactions.js";

const app = express();

// ── Middleware ────────────────────────────────────────────────

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
  ],
}));

app.use(express.json());
app.use(requestLogger);  // log OTLP por cada request

// ── Health ────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "kappy-engine", version: "0.1.0" });
});

// ── Rotas ─────────────────────────────────────────────────────

app.use("/api/stocks",       stocksRouter);
app.use("/api/sheets",       sheetsRouter);
app.use("/api/transactions", transactionsRouter);

// ── 404 + Error ───────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ── Arranque ──────────────────────────────────────────────────

app.listen(config.port, () => {
  logger.info("kappy-engine started", {
    "server.port":    config.port,
    "server.url":     `http://localhost:${config.port}`,
    "stocks.provider": config.stocks.provider,
  });

  const warnings = validateConfig();
  warnings.forEach(w => logger.warn("configuration warning", { "warning": w }));
});

export default app;
