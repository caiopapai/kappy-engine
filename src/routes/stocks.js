// src/routes/stocks.js
import { Router }           from "express";
import { getStockRepository } from "../repositories/stocks/StockRepositoryFactory.js";
import { logger }           from "../telemetry/logger.js";
import { withSpan }         from "../telemetry/tracer.js";

const router = Router();

// ── GET /api/stocks/search?q=PETR&type=stock ─────────────────

router.get("/search", async (req, res) => {
  const { q, type = "stock" } = req.query;

  if (!q || q.trim().length < 1) {
    return res.status(400).json({ ok: false, error: "Parâmetro 'q' obrigatório" });
  }

  await withSpan("route.stocks.search", { "query": q, "type": type }, async () => {
    try {
      const repo    = getStockRepository();
      const results = await repo.search(q.trim(), type);
      res.json({ ok: true, data: results, provider: repo.name });
    } catch (err) {
      logger.error("route.stocks.search error", { "query": q, "error": err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── GET /api/stocks/quote/:tickers ───────────────────────────

router.get("/quote/:tickers", async (req, res) => {
  const tickers = req.params.tickers.split(",").map(t => t.trim().toUpperCase());

  await withSpan("route.stocks.quote", { "tickers": tickers.join(",") }, async () => {
    try {
      const repo    = getStockRepository();
      const results = await repo.getQuote(tickers);

      // Resiliente: ticker não encontrado → resposta amigável, não 404
      if (results.length === 0) {
        logger.warn("route.stocks.quote not found", { "tickers": tickers.join(",") });
        return res.json({
          ok:        false,
          available: false,
          message:   `Cotação não disponível para: ${tickers.join(", ")}`,
          tickers,
        });
      }

      const data = tickers.length === 1 ? results[0] : results;
      res.json({ ok: true, available: true, data, provider: repo.name });

    } catch (err) {
      logger.error("route.stocks.quote error", { "tickers": tickers.join(","), "error": err.message });
      res.json({
        ok:        false,
        available: false,
        message:   "Serviço de cotações indisponível de momento",
        tickers,
      });
    }
  });
});

// ── GET /api/stocks/provider ─────────────────────────────────

router.get("/provider", (req, res) => {
  const repo = getStockRepository();
  res.json({ ok: true, provider: repo.name });
});

export default router;
