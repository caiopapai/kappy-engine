// src/routes/bootstrap.js
// Endpoint único que carrega todos os dados necessários ao arranque.
//
// GET /api/bootstrap
//
// Em vez de 10 chamadas separadas do frontend, o engine faz
// todas as leituras em paralelo numa única resposta.
// O cache do engine garante que a fonte de dados só é chamada
// uma vez por TTL — independentemente de ser Sheets, SQLite, Postgres, etc.
//
// Response:
// {
//   ok: true,
//   data: {
//     accounts, categories, subcategories, transactions,
//     recurringRules, investments, goals, budgets, settings
//   },
//   fromCache: true|false,
//   duration: 123  ← ms
// }

import { Router }            from "express";
import { sheetsRepository }  from "../repositories/sheets/SheetsRepository.js";
import { cache }             from "../cache/index.js";
import { logger }            from "../telemetry/logger.js";

const router = Router();

const ENTITIES = [
  "accounts", "categories", "subcategories", "transactions",
  "recurring_rules", "investments", "goals", "budgets", "settings",
];

router.get("/", async (req, res) => {
  const start    = Date.now();
  const cacheKey = "__bootstrap__";

  // Verifica se temos bootstrap completo em cache
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info("bootstrap.cache hit", { duration: Date.now() - start });
    return res.json({ ok: true, data: cached, fromCache: true, duration: Date.now() - start });
  }

  try {
    // Carrega todas as entidades em paralelo
    const results = await Promise.allSettled(
      ENTITIES.map(entity => sheetsRepository.getAll(entity))
    );

    const data = {};
    const errors = [];

    ENTITIES.forEach((entity, i) => {
      const result = results[i];
      if (result.status === "fulfilled") {
        // Normaliza o nome: recurring_rules → recurringRules
        const key = entity.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        data[key] = result.value;
      } else {
        errors.push({ entity, error: result.reason?.message });
        const key = entity.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        data[key] = []; // fallback para array vazio em vez de falhar tudo
        logger.error("bootstrap.entity failed", { entity, error: result.reason?.message });
      }
    });

    const duration = Date.now() - start;

    // Guarda o bootstrap em cache com TTL mínimo das entidades (20s)
    cache.set(cacheKey, data);

    logger.info("bootstrap.complete", {
      duration,
      entities: ENTITIES.length,
      errors:   errors.length,
    });

    res.json({
      ok:        true,
      data,
      fromCache: false,
      duration,
      ...(errors.length > 0 && { warnings: errors }),
    });

  } catch (err) {
    logger.error("bootstrap.error", { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;