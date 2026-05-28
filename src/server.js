// src/server.js
// Entry point do kappy-engine.
// Arranca o servidor Express com todas as rotas registadas.

import express    from "express";
import cors       from "cors";
import { config, validateConfig } from "./config/index.js";
import stocksRouter from "./routes/stocks.js";
import sheetsRouter from "./routes/sheets.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();

// ── Middleware ────────────────────────────────────────────────

app.use(cors({
  origin: [
    "http://localhost:5173",   // kappy (Vite dev)
    "http://localhost:4173",   // kappy (Vite preview)
    "http://localhost:3000",   // kappy (alternativa)
  ],
}));

app.use(express.json());

// ── Health check ──────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({
    ok:      true,
    service: "kappy-engine",
    version: "0.1.0",
  });
});

// ── Rotas ─────────────────────────────────────────────────────

app.use("/api/stocks", stocksRouter);
app.use("/api/sheets", sheetsRouter);

// ── 404 + Error handler ───────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ── Arranque ──────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`\n🚀 kappy-engine running on http://localhost:${config.port}`);
  console.log(`   Health: http://localhost:${config.port}/health\n`);

  const warnings = validateConfig();
  if (warnings.length > 0) {
    console.warn("⚠️  Configuração incompleta:");
    warnings.forEach(w => console.warn(`   - ${w}`));
    console.log("");
  }
});

export default app;
