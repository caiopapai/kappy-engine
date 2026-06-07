// src/routes/loans.js
// Empréstimos com cálculo automático do `paid`.
//
// GET  /api/loans          → lista com paid calculado e progresso
// POST /api/loans          → cria/actualiza empréstimo
// DELETE /api/loans/:id    → elimina empréstimo

import { Router }     from "express";
import { repository } from "../repositories/RepositoryFactory.js";
import { logger }     from "../telemetry/logger.js";
import { withSpan }   from "../telemetry/tracer.js";
import { setupLoanCategories } from "./autoCategories.js";

const router = Router();

// Calcula o paid de um empréstimo a partir das transações
async function calcPaid(loanId) {
  const transactions = await repository.getAll("transactions");
  return transactions
    .filter(tx => String(tx.entityId) === String(loanId) && tx.entityType === "loan")
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
}

// ── GET /api/loans ────────────────────────────────────────────

router.get("/", async (req, res) => {
  await withSpan("route.loans.list", {}, async () => {
    try {
      const loans = await repository.getAll("loans");

      const withProgress = await Promise.all(loans.map(async loan => {
        const txPaid     = await calcPaid(loan.id);
        const basePaid   = parseFloat(loan.paid) || 0;
        const paid       = basePaid + txPaid;
        const contracted = parseFloat(loan.contracted) || 0;
        const remaining  = Math.max(contracted - paid, 0);
        const paidPercent = contracted > 0
          ? Math.min(Math.round((paid / contracted) * 100), 100)
          : 0;

        // Data de fim estimada se não definida
        let endDate = loan.end_date;
        if (!endDate && loan.installment && loan.start_date) {
          const installment  = parseFloat(loan.installment) || 0;
          const monthsLeft   = installment > 0 ? Math.ceil(remaining / installment) : 0;
          const start        = new Date(loan.start_date);
          start.setMonth(start.getMonth() + monthsLeft);
          endDate = start.toISOString().slice(0, 10);
        }

        return {
          ...loan,
          contracted,
          paid:         Math.round(paid * 100) / 100,
          remaining:    Math.round(remaining * 100) / 100,
          paidPercent,
          endDate,
        };
      }));

      res.json({ ok: true, data: withProgress, count: withProgress.length });
    } catch (err) {
      logger.error("loans.list error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── POST /api/loans ───────────────────────────────────────────

router.post("/", async (req, res) => {
  const { row } = req.body;
  if (!row) return res.status(400).json({ ok: false, error: "'row' obrigatório" });
  if (!row.name || !row.contracted) {
    return res.status(400).json({ ok: false, error: "name e contracted obrigatórios" });
  }

  await withSpan("route.loans.save", {}, async () => {
    try {
      const toSave = row.id ? row : { ...row, id: Date.now() };
      await repository.save("loans", toSave);
      logger.info("loans.save", { id: toSave.id });

      // Cria categoria, subcategoria e regra recorrente automaticamente
      if (toSave.installment && toSave.accountId) {
        const accounts = await repository.getAll("accounts");
        const account  = accounts.find(a => String(a.id) === String(toSave.accountId));
        const accountName = account?.name || "Conta";
        await setupLoanCategories(toSave, accountName).catch(err =>
          logger.error("loans.autoCategory failed", { error: err.message })
        );
      }

      res.json({ ok: true, data: toSave });
    } catch (err) {
      logger.error("loans.save error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── DELETE /api/loans/:id ─────────────────────────────────────

router.delete("/:id", async (req, res) => {
  await withSpan("route.loans.delete", { id: req.params.id }, async () => {
    try {
      await repository.delete("loans", req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error("loans.delete error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

export default router;