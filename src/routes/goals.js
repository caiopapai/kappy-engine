// src/routes/goals.js
// Metas com progresso calculado pelo engine.
//
// O progresso de uma meta é a soma das operações de investimento
// (compras - vendas) das contas associadas ao objectivo.
//
// GET  /api/goals           → lista com currentValue calculado
// POST /api/goals           → cria/actualiza meta
// POST /api/goals/:id/recalc → força recálculo do progresso
// DELETE /api/goals/:id     → elimina meta

import { Router }            from "express";
import { sheetsRepository }  from "../repositories/sheets/SheetsRepository.js";
import { logger }            from "../telemetry/logger.js";
import { withSpan }          from "../telemetry/tracer.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────

// Converte "1,2,3" → [1, 2, 3]
function parseAccountIds(raw) {
  if (!raw) return [];
  return String(raw).split(",").map(s => s.trim()).filter(Boolean).map(Number);
}

// Calcula o progresso de uma meta com base nas operações de investimento
function calcProgress(goal, investments) {
  const accountIds = parseAccountIds(goal.accountIds);
  if (accountIds.length === 0) return 0;

  const relevant = investments.filter(inv =>
    accountIds.includes(Number(inv.accountId))
  );

  if (goal.type === "invested") {
    // Soma total comprado - total vendido
    return relevant.reduce((sum, inv) => {
      const amount = parseFloat(inv.totalValue) || 0;
      return sum + (inv.opType === "buy" ? amount : -amount);
    }, 0);
  }

  if (goal.type === "dividends") {
    // Rendimento mensal estimado via DY anual
    const portfolio = {};
    relevant.forEach(inv => {
      const t = inv.ticker;
      if (!portfolio[t]) portfolio[t] = { qty: 0, totalBought: 0, dyAnnual: 0, currency: inv.currency };
      const qty = parseFloat(inv.quantity) || 0;
      if (inv.opType === "buy") {
        portfolio[t].qty         += qty;
        portfolio[t].totalBought += qty * (parseFloat(inv.unitPrice) || 0);
        if (inv.dyAnnual != null) portfolio[t].dyAnnual = parseFloat(inv.dyAnnual) || 0;
      } else {
        portfolio[t].qty -= qty;
      }
    });

    return Object.values(portfolio)
      .filter(p => p.qty > 0)
      .reduce((sum, p) => {
        const avgPrice    = p.qty > 0 ? p.totalBought / p.qty : 0;
        const monthlyIncome = avgPrice * p.qty * (p.dyAnnual / 100 / 12);
        return sum + monthlyIncome;
      }, 0);
  }

  return 0;
}

// Actualiza o currentValue de um goal na sheet
async function updateGoalProgress(goalId, currentValue) {
  const goals = await sheetsRepository.getAll("goals");
  const goal  = goals.find(g => String(g.id) === String(goalId));
  if (!goal) return;

  await sheetsRepository.save("goals", { ...goal, currentValue });
  logger.info("goals.progress updated", { goalId, currentValue });
}

// ── GET /api/goals ────────────────────────────────────────────

router.get("/", async (req, res) => {
  await withSpan("route.goals.list", {}, async () => {
    try {
      const [goals, investments] = await Promise.all([
        sheetsRepository.getAll("goals"),
        sheetsRepository.getAll("investments"),
      ]);

      // Recalcula progresso para cada meta
      const goalsWithProgress = goals.map(goal => ({
        ...goal,
        accountIds:   goal.accountIds || "",
        currentValue: calcProgress(goal, investments),
        targetValue:  parseFloat(goal.targetValue) || 0,
      }));

      res.json({ ok: true, data: goalsWithProgress, count: goalsWithProgress.length });
    } catch (err) {
      logger.error("goals.list error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── POST /api/goals ───────────────────────────────────────────

router.post("/", async (req, res) => {
  const { row } = req.body;
  if (!row) return res.status(400).json({ ok: false, error: "'row' obrigatório" });
  if (!row.label) return res.status(400).json({ ok: false, error: "label obrigatório" });

  await withSpan("route.goals.save", {}, async () => {
    try {
      const toSave = {
        ...row,
        id:           row.id || Date.now(),
        accountIds:   Array.isArray(row.accountIds)
                        ? row.accountIds.join(",")
                        : (row.accountIds || ""),
        currentValue: 0, // será recalculado no GET
      };

      await sheetsRepository.save("goals", toSave);

      // Recalcula progresso imediatamente
      const investments  = await sheetsRepository.getAll("investments");
      const currentValue = calcProgress(toSave, investments);
      if (currentValue > 0) {
        await sheetsRepository.save("goals", { ...toSave, currentValue });
        toSave.currentValue = currentValue;
      }

      logger.info("goals.save", { id: toSave.id, accountIds: toSave.accountIds });
      res.json({ ok: true, data: toSave });
    } catch (err) {
      logger.error("goals.save error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── POST /api/goals/:id/recalc ────────────────────────────────

router.post("/:id/recalc", async (req, res) => {
  const { id } = req.params;
  await withSpan("route.goals.recalc", { id }, async () => {
    try {
      const [goals, investments] = await Promise.all([
        sheetsRepository.getAll("goals"),
        sheetsRepository.getAll("investments"),
      ]);
      const goal = goals.find(g => String(g.id) === String(id));
      if (!goal) return res.status(404).json({ ok: false, error: "Meta não encontrada" });

      const currentValue = calcProgress(goal, investments);
      await sheetsRepository.save("goals", { ...goal, currentValue });

      res.json({ ok: true, id, currentValue });
    } catch (err) {
      logger.error("goals.recalc error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── DELETE /api/goals/:id ─────────────────────────────────────

router.delete("/:id", async (req, res) => {
  await withSpan("route.goals.delete", { id: req.params.id }, async () => {
    try {
      await sheetsRepository.delete("goals", req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error("goals.delete error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

export { router as goalsRouter, calcProgress, parseAccountIds, updateGoalProgress };
export default router;