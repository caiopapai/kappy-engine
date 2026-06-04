// src/routes/entities.js
// Factory de routers CRUD para entidades simples.
// Cada entidade recebe o seu próprio router com a entidade fixada no closure.

import { Router }            from "express";
import { sheetsRepository }  from "../repositories/sheets/SheetsRepository.js";
import { logger }            from "../telemetry/logger.js";
import { withSpan }          from "../telemetry/tracer.js";

const ALLOWED = new Set([
  "accounts", "categories", "subcategories",
  "investments", "goals", "budgets", "recurring_rules",
  "settings",
]);

// Campos obrigatórios por entidade
const REQUIRED_FIELDS = {
  investments: ["assetType", "ticker", "opType", "date", "quantity", "unitPrice"],
  accounts:    ["name", "type", "balance", "currency"],
  goals:       ["label", "targetValue"],
  transactions: ["amount", "date", "type", "accountId"],
};

export function makeEntityRouter(entity) {
  if (!ALLOWED.has(entity)) {
    throw new Error(`Entidade não permitida: ${entity}`);
  }

  const router = Router();

  // ── GET /api/:entity ────────────────────────────────────────

  router.get("/", async (req, res) => {
    await withSpan(`route.${entity}.list`, {}, async () => {
      try {
        const data = await sheetsRepository.getAll(entity);
        res.json({ ok: true, data, count: data.length });
      } catch (err) {
        logger.error(`route.${entity}.list error`, { error: err.message });
        res.status(500).json({ ok: false, error: err.message });
      }
    });
  });

  // ── POST /api/:entity ───────────────────────────────────────

  router.post("/", async (req, res) => {
    const { row } = req.body;
    if (!row) {
      return res.status(400).json({ ok: false, error: "'row' obrigatório" });
    }

    // Valida campos obrigatórios
    const required = REQUIRED_FIELDS[entity] || [];
    const missing  = required.filter(f => row[f] == null || row[f] === "");
    if (missing.length > 0) {
      return res.status(400).json({ ok: false, error: `Campos obrigatórios em falta: ${missing.join(", ")}` });
    }

    await withSpan(`route.${entity}.save`, {}, async () => {
      try {
        const toSave = row.id ? row : { ...row, id: Date.now() };
        await sheetsRepository.save(entity, toSave);
        logger.info(`${entity}.save`, { id: toSave.id });
        res.json({ ok: true, data: toSave });
      } catch (err) {
        logger.error(`route.${entity}.save error`, { error: err.message });
        res.status(500).json({ ok: false, error: err.message });
      }
    });
  });

  // ── POST /api/:entity/bulk ──────────────────────────────────

  router.post("/bulk", async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ ok: false, error: "'rows' deve ser array" });
    }
    await withSpan(`route.${entity}.bulk`, { count: rows.length }, async () => {
      try {
        await sheetsRepository.bulkSave(entity, rows);
        logger.info(`${entity}.bulk`, { count: rows.length });
        res.json({ ok: true, count: rows.length });
      } catch (err) {
        logger.error(`route.${entity}.bulk error`, { error: err.message });
        res.status(500).json({ ok: false, error: err.message });
      }
    });
  });

  // ── DELETE /api/:entity/:id ─────────────────────────────────

  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    await withSpan(`route.${entity}.delete`, { id }, async () => {
      try {
        await sheetsRepository.delete(entity, id);
        logger.info(`${entity}.delete`, { id });
        res.json({ ok: true });
      } catch (err) {
        logger.error(`route.${entity}.delete error`, { id, error: err.message });
        res.status(500).json({ ok: false, error: err.message });
      }
    });
  });

  return router;
}