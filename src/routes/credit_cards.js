// src/routes/credit_cards.js
// Cartões de crédito com cálculo automático do `used`.
//
// O `used` pode ser:
//   - Definido manualmente (estado inicial)
//   - Recalculado pelo engine a partir das transações
//
// GET  /api/credit_cards            → lista com used calculado
// POST /api/credit_cards            → cria/actualiza cartão
// DELETE /api/credit_cards/:id      → elimina cartão
// POST /api/credit_cards/:id/recalc → força recálculo do used

import { Router }           from "express";
import { repository }       from "../repositories/RepositoryFactory.js";
import { logger }           from "../telemetry/logger.js";
import { withSpan }         from "../telemetry/tracer.js";
import { setupCardCategories } from "./autoCategories.js";

const router = Router();

// Calcula o used de um cartão a partir das transações
async function calcUsed(cardId) {
  const transactions = await repository.getAll("transactions");
  return transactions
    .filter(tx => String(tx.entityId) === String(cardId) && tx.entityType === "credit_card")
    .reduce((sum, tx) => {
      const amount = parseFloat(tx.amount) || 0;
      // payment reduz o used, expense aumenta
      return tx.type === "payment" ? sum - amount : sum + amount;
    }, 0);
}

// ── GET /api/credit_cards ─────────────────────────────────────

router.get("/", async (req, res) => {
  await withSpan("route.credit_cards.list", {}, async () => {
    try {
      const cards = await repository.getAll("credit_cards");

      // Recalcula used para cada cartão
      const withUsed = await Promise.all(cards.map(async card => {
        const txUsed   = await calcUsed(card.id);
        const baseUsed = parseFloat(card.used) || 0;
        // used = base manual + transações desde o setup
        const used      = baseUsed + txUsed;
        const limit     = parseFloat(card.limit) || 0;
        const available = Math.max(limit - used, 0);

        return {
          ...card,
          limit,
          used:         Math.round(used * 100) / 100,
          available:    Math.round(available * 100) / 100,
          usedPercent:  limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0,
        };
      }));

      res.json({ ok: true, data: withUsed, count: withUsed.length });
    } catch (err) {
      logger.error("credit_cards.list error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── POST /api/credit_cards ────────────────────────────────────

router.post("/", async (req, res) => {
  const { row } = req.body;
  if (!row) return res.status(400).json({ ok: false, error: "'row' obrigatório" });
  if (!row.name || !row.limit) {
    return res.status(400).json({ ok: false, error: "name e limit obrigatórios" });
  }

  await withSpan("route.credit_cards.save", {}, async () => {
    try {
      const toSave = row.id ? row : { ...row, id: Date.now() };
      await repository.save("credit_cards", toSave);
      logger.info("credit_cards.save", { id: toSave.id });

      // Cria categoria e subcategoria automaticamente
      if (toSave.accountId) {
        const accounts    = await repository.getAll("accounts");
        const account     = accounts.find(a => String(a.id) === String(toSave.accountId));
        const accountName = account?.name || "Conta";
        await setupCardCategories(toSave, accountName).catch(err =>
          logger.error("credit_cards.autoCategory failed", { error: err.message })
        );
      }

      res.json({ ok: true, data: toSave });
    } catch (err) {
      logger.error("credit_cards.save error", { error: err.message, row });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── DELETE /api/credit_cards/:id ──────────────────────────────

router.delete("/:id", async (req, res) => {
  await withSpan("route.credit_cards.delete", { id: req.params.id }, async () => {
    try {
      await repository.delete("credit_cards", req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error("credit_cards.delete error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── POST /api/credit_cards/:id/recalc ─────────────────────────

router.post("/:id/recalc", async (req, res) => {
  const { id } = req.params;
  await withSpan("route.credit_cards.recalc", { id }, async () => {
    try {
      const cards = await repository.getAll("credit_cards");
      const card  = cards.find(c => String(c.id) === String(id));
      if (!card) return res.status(404).json({ ok: false, error: "Cartão não encontrado" });

      const txUsed  = await calcUsed(id);
      const used    = (parseFloat(card.used) || 0) + txUsed;
      const limit   = parseFloat(card.limit) || 0;
      const available = Math.max(limit - used, 0);

      res.json({ ok: true, id, used, available, usedPercent: limit > 0 ? Math.round((used / limit) * 100) : 0 });
    } catch (err) {
      logger.error("credit_cards.recalc error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

export default router;