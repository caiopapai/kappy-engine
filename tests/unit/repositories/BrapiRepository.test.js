// src/repositories/stocks/BrapiRepository.js
import { IStockRepository } from "./IStockRepository.js";
import { config }           from "../../config/index.js";
import { logger }           from "../../telemetry/logger.js";
import { withSpan }         from "../../telemetry/tracer.js";

export class BrapiRepository extends IStockRepository {
  get name() { return "brapi.dev"; }

  // ── Pesquisa ──────────────────────────────────────────────

  search(query, type = "stock") {
    return withSpan("brapi.search", { "query": query, "type": type }, async (span) => {
      if (!query || query.length < 1) {
        return [];
      }

      const params = new URLSearchParams({ search: query, limit: "20" });
      if (type && type !== "all") {
        params.append("type", type);
      }
      if (config.brapi.token) {
        params.append("token", config.brapi.token);
      }

      const url = `${config.brapi.baseUrl}/quote/list?${params}`;
      logger.info("brapi.search request", { "query": query, "type": type, "url": url });

      try {
        const res  = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          logger.warn("brapi.search non-200 response", {
            "http.status_code": res.status,
            "query": query,
          });
          return [];
        }

        if (!data.stocks) {
          logger.warn("brapi.search empty response", { "query": query });
          return [];
        }

        const allResults = data.stocks.map((s) => ({
          ticker:   s.stock,
          name:     s.name   || s.stock,
          type:     s.type   || type,
          sector:   s.sector || null,
          price:    s.close  || null,
          change:   s.change || null,
          currency: "BRL",
        }));

        const results = allResults.filter((s) => {
          if (!s.ticker || !s.name) {
            return false;
          }
          if (s.price !== null && s.price <= 0) {
            return false;
          }
          return true;
        });

        const removed = allResults.length - results.length;
        if (removed > 0) {
          logger.info("brapi.search filtered inactive stocks", {
            "query":   query,
            "removed": removed,
            "kept":    results.length,
          });
        }

        logger.info("brapi.search success", { "query": query, "results": results.length });
        span.setAttribute("results.count", results.length);
        return results;

      } catch (err) {
        logger.error("brapi.search failed", { "query": query, "error": err.message });
        return [];
      }
    });
  }

  // ── Cotação ───────────────────────────────────────────────

  getQuote(tickers) {
    const tickerList = Array.isArray(tickers) ? tickers : [tickers];

    return withSpan("brapi.getQuote", { "tickers": tickerList.join(",") }, async (span) => {
      if (tickerList.length === 0) {
        return [];
      }

      const params = new URLSearchParams();
      if (config.brapi.token) {
        params.append("token", config.brapi.token);
      }

      const url = `${config.brapi.baseUrl}/quote/${tickerList.join(",")}?${params}`;
      logger.info("brapi.getQuote request", { "tickers": tickerList.join(",") });

      try {
        const res  = await fetch(url);
        const data = await res.json();

        if (res.status === 404 || !data.results || data.results.length === 0) {
          logger.warn("brapi.getQuote ticker not found", {
            "tickers":          tickerList.join(","),
            "http.status_code": res.status,
          });
          return [];
        }

        if (!res.ok) {
          logger.warn("brapi.getQuote non-200 response", {
            "tickers":          tickerList.join(","),
            "http.status_code": res.status,
          });
          return [];
        }

        const allQuotes = data.results.map((r) => ({
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

        const results = allQuotes.filter((r) => {
          if (r.price === null || r.price === undefined) {
            logger.warn("brapi.getQuote price null — possible suspended/delisted", {
              "ticker": r.ticker,
            });
            return false;
          }
          if (r.price <= 0) {
            logger.warn("brapi.getQuote price zero or negative — possible suspended", {
              "ticker": r.ticker,
              "price":  r.price,
            });
            return false;
          }
          return true;
        });

        logger.info("brapi.getQuote success", {
          "tickers": tickerList.join(","),
          "results": results.length,
        });
        span.setAttribute("results.count", results.length);
        return results;

      } catch (err) {
        logger.error("brapi.getQuote failed", {
          "tickers": tickerList.join(","),
          "error":   err.message,
        });
        return [];
      }
    });
  }
}
