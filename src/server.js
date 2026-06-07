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
import budgetsRouter      from "./routes/budgets.js";
import goalsRouter        from "./routes/goals.js";
import investmentsRouter  from "./routes/investments.js";
import creditCardsRouter  from "./routes/credit_cards.js";
import loansRouter        from "./routes/loans.js";
import { makeEntityRouter } from "./routes/entities.js";
import configRouter       from "./routes/config.js";
import settingsRouter     from "./routes/settings.js";
import bootstrapRouter    from "./routes/bootstrap.js";
import { cache }          from "./cache/index.js";

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
  res.json({ ok: true, service: "kappy-engine", version: "0.1.0", cache: cache.stats() });
});

// ── Rotas ─────────────────────────────────────────────────────

app.use("/api/bootstrap",    bootstrapRouter);
app.use("/api/stocks",       stocksRouter);
app.use("/api/config",       configRouter);
app.use("/api/settings",     settingsRouter);
app.use("/api/sheets",       sheetsRouter);   // mantido para compatibilidade
app.use("/api/transactions", transactionsRouter);
app.use("/api/budgets",      budgetsRouter);
app.use("/api/goals",        goalsRouter);
app.use("/api/investments",  investmentsRouter);
app.use("/api/credit_cards", creditCardsRouter);
app.use("/api/loans",        loansRouter);

// Entidades CRUD simples
[
  "accounts", "categories", "subcategories", "recurring_rules",
].forEach(entity => {
  app.use(`/api/${entity}`, makeEntityRouter(entity));
});

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