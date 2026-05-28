// src/repositories/stocks/BrapiRepository.js
// Implementação do IStockRepository usando brapi.dev
// Documentação: https://brapi.dev/docs

import { IStockRepository } from "./IStockRepository.js";
import { config } from "../../config/index.js";

export class BrapiRepository extends IStockRepository {
  get name() {
    return "brapi.dev";
  }

  // ── Pesquisa de ativos ────────────────────────────────────

  async search(query, type = "stock") {
    if (!query || query.length < 1) return [];

    const params = new URLSearchParams({
      search: query,
      limit:  "20",
    });

    // Filtra por tipo se especificado
    if (type && type !== "all") {
      params.append("type", type);
    }

    if (config.brapi.token) {
      params.append("token", config.brapi.token);
    }

    const url = `${config.brapi.baseUrl}/quote/list?${params}`;

    try {
      const res  = await fetch(url);
      const data = await res.json();

      if (!data.stocks) return [];

      return data.stocks.map(s => ({
        ticker:       s.stock,
        name:         s.name   || s.stock,
        type:         s.type   || type,
        sector:       s.sector || null,
        price:        s.close  || null,
        change:       s.change || null,
        currency:     "BRL",
      }));
    } catch (err) {
      console.error("[BrapiRepository] search error:", err.message);
      return [];
    }
  }

  // ── Cotação actual ────────────────────────────────────────

  async getQuote(tickers) {
    const tickerList = Array.isArray(tickers) ? tickers : [tickers];
    if (tickerList.length === 0) return [];

    const params = new URLSearchParams();
    if (config.brapi.token) {
      params.append("token", config.brapi.token);
    }

    const url = `${config.brapi.baseUrl}/quote/${tickerList.join(",")}?${params}`;

    try {
      const res  = await fetch(url);
      const data = await res.json();

      if (!data.results) return [];

      return data.results.map(r => ({
        ticker:        r.symbol,
        name:          r.shortName || r.longName || r.symbol,
        price:         r.regularMarketPrice,
        currency:      "BRL",
        change:        r.regularMarketChange,
        changePercent: r.regularMarketChangePercent,
        volume:        r.regularMarketVolume,
        high:          r.regularMarketDayHigh,
        low:           r.regularMarketDayLow,
        updatedAt:     r.regularMarketTime,
        source:        "brapi.dev",
      }));
    } catch (err) {
      console.error("[BrapiRepository] getQuote error:", err.message);
      return [];
    }
  }
}
