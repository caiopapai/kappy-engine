// src/routes/investments.js
// Operações de investimento com recálculo automático do progresso das metas.
//
// Após cada POST ou DELETE, o engine recalcula o currentValue
// de todos os goals que têm a conta do investimento associada.

import { Router }            from "express";
import { sheetsRepository }  from "../repositories/sheets/SheetsRepository.js";
import { logger }            from "../telemetry/logger.js";
import { withSpan }          from "../telemetry/tracer.js";
import { calcProgress, parseAccountIds } from "./goals.js";

const router = Router();

// ── Recalcula goals afectados por uma conta ───────────────────

async function recalcGoalsForAccount(accountId) {
  try {
    const [goals, investments] = await Promise.all([
      sheetsRepository.getAll("goals"),
      sheetsRepository.getAll("investments"),
    ]);

    const affected = goals.filter(g =>
      parseAccountIds(g.accountIds).includes(Number(accountId))
    );

    await Promise.all(affected.map(async goal => {
      const currentValue = calcProgress(goal, investments);
      await sheetsRepository.save("goals", { ...goal, currentValue });
      logger.info("investments.recalcGoal", { goalId: goal.id, accountId, currentValue });
    }));

    if (affected.length > 0) {
      logger.info("investments.goalsRecalculated", { count: affected.length, accountId });
    }
  } catch (err) {
    // Não bloqueia a operação principal se o recálculo falhar
    logger.error("investments.recalcGoals error", { error: err.message });
  }
}

// ── GET /api/investments ──────────────────────────────────────

router.get("/", async (req, res) => {
  await withSpan("route.investments.list", {}, async () => {
    try {
      const data = await sheetsRepository.getAll("investments");
      res.json({ ok: true, data, count: data.length });
    } catch (err) {
      logger.error("route.investments.list error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── POST /api/investments ─────────────────────────────────────

router.post("/", async (req, res) => {
  const { row } = req.body;
  if (!row) return res.status(400).json({ ok: false, error: "'row' obrigatório" });

  const required = ["assetType", "ticker", "opType", "date", "quantity", "unitPrice"];
  const missing  = required.filter(f => row[f] == null || row[f] === "");
  if (missing.length > 0) {
    return res.status(400).json({ ok: false, error: `Campos obrigatórios em falta: ${missing.join(", ")}` });
  }

  await withSpan("route.investments.save", {}, async () => {
    try {
      const toSave = row.id ? row : { ...row, id: Date.now() };
      await sheetsRepository.save("investments", toSave);
      logger.info("investments.save", { id: toSave.id, ticker: toSave.ticker });

      // Recalcula goals afectados (não bloqueia a resposta)
      if (toSave.accountId) {
        recalcGoalsForAccount(toSave.accountId);
      }

      res.json({ ok: true, data: toSave });
    } catch (err) {
      logger.error("route.investments.save error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── DELETE /api/investments/:id ───────────────────────────────

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await withSpan("route.investments.delete", { id }, async () => {
    try {
      // Lê o investimento antes de apagar para saber a conta
      const investments = await sheetsRepository.getAll("investments");
      const inv         = investments.find(i => String(i.id) === String(id));

      await sheetsRepository.delete("investments", id);
      logger.info("investments.delete", { id });

      // Recalcula goals afectados
      if (inv?.accountId) {
        recalcGoalsForAccount(inv.accountId);
      }

      res.json({ ok: true });
    } catch (err) {
      logger.error("route.investments.delete error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

export default router;