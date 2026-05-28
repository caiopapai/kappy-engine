// src/routes/stocks.js
// Endpoints de cotações e pesquisa de ativos.
//
// GET /api/stocks/search?q=PETR&type=stock   → pesquisa ativos
// GET /api/stocks/quote/:ticker              → cotação de um ticker
// GET /api/stocks/quote/:ticker1,:ticker2    → cotação de múltiplos

import { Router } from "express";
import { getStockRepository } from "../repositories/stocks/StockRepositoryFactory.js";

const router = Router();

// ── Pesquisa ──────────────────────────────────────────────────
// GET /api/stocks/search?q=PETR&type=stock

router.get("/search", async (req, res) => {
  const { q, type = "stock" } = req.query;

  if (!q || q.trim().length < 1) {
    return res.status(400).json({ ok: false, error: "Parâmetro 'q' obrigatório" });
  }

  try {
    const repo    = getStockRepository();
    const results = await repo.search(q.trim(), type);
    res.json({ ok: true, data: results, provider: repo.name });
  } catch (err) {
    console.error("[stocks/search]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Cotação ───────────────────────────────────────────────────
// GET /api/stocks/quote/PETR4
// GET /api/stocks/quote/PETR4,VALE3

router.get("/quote/:tickers", async (req, res) => {
  const tickers = req.params.tickers.split(",").map(t => t.trim().toUpperCase());

  if (tickers.length === 0) {
    return res.status(400).json({ ok: false, error: "Ticker obrigatório" });
  }

  try {
    const repo    = getStockRepository();
    const results = await repo.getQuote(tickers);

    if (results.length === 0) {
      return res.status(404).json({ ok: false, error: "Ticker não encontrado" });
    }

    // Se pediu um só, devolve objecto; se pediu vários, devolve array
    const data = tickers.length === 1 ? results[0] : results;
    res.json({ ok: true, data, provider: repo.name });
  } catch (err) {
    console.error("[stocks/quote]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Provider activo ───────────────────────────────────────────
// GET /api/stocks/provider

router.get("/provider", (req, res) => {
  const repo = getStockRepository();
  res.json({ ok: true, provider: repo.name });
});

export default router;
