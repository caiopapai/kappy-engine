// src/routes/transactions.js
// Operações de transações com actualização atómica do saldo da conta.
// O frontend nunca calcula saldos — isso é responsabilidade do engine.
//
// POST /api/transactions        → cria transação + actualiza saldo
// DELETE /api/transactions/:id  → elimina transação + reverte saldo
// GET /api/transactions         → lista todas (proxy para sheets)

import { Router }              from "express";
import { repository as sheetsRepository } from "../repositories/RepositoryFactory.js";
import { logger }              from "../telemetry/logger.js";
import { withSpan }            from "../telemetry/tracer.js";

const router = Router();

// ── GET /api/transactions ─────────────────────────────────────

router.get("/", async (req, res) => {
  await withSpan("route.transactions.list", {}, async () => {
    try {
      const data = await sheetsRepository.getAll("transactions");
      res.json({ ok: true, data, count: data.length });
    } catch (err) {
      logger.error("route.transactions.list error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── GET /api/transactions/recurring ──────────────────────────

router.get("/recurring", async (req, res) => {
  await withSpan("route.transactions.recurring.list", {}, async () => {
    try {
      const data = await sheetsRepository.getAll("recurring_rules");
      res.json({ ok: true, data, count: data.length });
    } catch (err) {
      logger.error("route.transactions.recurring.list error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── POST /api/transactions ────────────────────────────────────
// Body: { transaction: {...} }
// Cria/actualiza a transação E actualiza o saldo da conta atomicamente.
// Em caso de erro a meio, tenta reverter.

router.post("/", async (req, res) => {
  const { transaction } = req.body;

  if (!transaction || !transaction.amount) {
    return res.status(400).json({ ok: false, error: "transaction inválida" });
  }

  await withSpan("route.transactions.save", {
    "transaction.type":      transaction.type,
    "transaction.accountId": String(transaction.accountId),
    "transaction.amount":    transaction.amount,
  }, async () => {
    try {
      const toSave  = transaction.id ? transaction : { ...transaction, id: Date.now() };
      const isNew   = !transaction.id;
      const isPos   = transaction.type === "income";
      const amount  = parseFloat(transaction.amount);
      const entity  = transaction.entityType || "account";

      const txDate  = toSave.date ? toSave.date.slice(0, 10) : "";
      const today   = new Date().toISOString().slice(0, 10);
      const affectsBalance = txDate <= today;

      await repository.save("transactions", toSave);
      logger.info("transaction saved", { id: toSave.id, type: toSave.type, amount, entity, affectsBalance });

      if (isNew && affectsBalance) {
        if (entity === "account") {
          const accounts = await repository.getAll("accounts");
          const account  = accounts.find(a => String(a.id) === String(toSave.accountId || toSave.entityId));
          if (account) {
            await repository.save("accounts", { ...account, balance: (parseFloat(account.balance) || 0) + (isPos ? amount : -amount) });
          }
        } else if (entity === "credit_card" && transaction.type === "payment" && toSave.accountId) {
          // Pagamento de fatura — debita a conta corrente associada
          const accounts = await repository.getAll("accounts");
          const account  = accounts.find(a => String(a.id) === String(toSave.accountId));
          if (account) {
            await repository.save("accounts", { ...account, balance: (parseFloat(account.balance) || 0) - amount });
          }
        } else if (entity === "loan" && toSave.accountId) {
          // Prestação — debita a conta corrente associada
          const accounts = await repository.getAll("accounts");
          const account  = accounts.find(a => String(a.id) === String(toSave.accountId));
          if (account) {
            await repository.save("accounts", { ...account, balance: (parseFloat(account.balance) || 0) - amount });
          }
        }
      }

      res.json({ ok: true, data: toSave });

    } catch (err) {
      logger.error("route.transactions.save error", { "error": err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── DELETE /api/transactions/:id ──────────────────────────────
// Elimina a transação E reverte o saldo da conta.

router.delete("/:id", async (req, res) => {
  const id = req.params.id;

  await withSpan("route.transactions.delete", { "transaction.id": id }, async () => {
    try {
      // Busca a transação antes de apagar para saber o valor e conta
      const transactions = await sheetsRepository.getAll("transactions");
      const transaction  = transactions.find(t => String(t.id) === String(id));

      if (!transaction) {
        return res.status(404).json({ ok: false, error: `Transação ${id} não encontrada` });
      }

      const isPos          = transaction.type === "income";
      const amount         = parseFloat(transaction.amount);
      const txDate         = transaction.date ? transaction.date.slice(0, 10) : "";
      const today          = new Date().toISOString().slice(0, 10);
      const affectsBalance = txDate <= today;

      // Apaga a transação
      await sheetsRepository.delete("transactions", id);
      logger.info("transaction deleted", { "id": id, "type": transaction.type, "amount": amount, "date": txDate });

      // Reverte saldo apenas se a transação tinha data <= hoje
      if (affectsBalance) {
        const accounts = await sheetsRepository.getAll("accounts");
        const account  = accounts.find(a => a.id === transaction.accountId);

        if (account) {
          const newBalance = account.balance - (isPos ? amount : -amount);
          await sheetsRepository.save("accounts", { ...account, balance: newBalance });
          logger.info("account balance reverted", {
            "accountId":  account.id,
            "oldBalance": account.balance,
            "newBalance": newBalance,
          });
        }
      } else {
        logger.info("future-dated transaction deleted — balance not changed", { "date": txDate });
      }

      res.json({ ok: true, message: `Transação ${id} eliminada` });

    } catch (err) {
      logger.error("route.transactions.delete error", { "id": id, "error": err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── POST /api/transactions/recurring ─────────────────────────

router.post("/recurring", async (req, res) => {
  const { rule } = req.body;

  if (!rule || !rule.accountId || !rule.amount) {
    return res.status(400).json({ ok: false, error: "rule inválida" });
  }

  await withSpan("route.transactions.recurring.save", {}, async () => {
    try {
      const toSave = rule.id ? rule : { ...rule, id: Date.now() };
      await sheetsRepository.save("recurring_rules", toSave);
      logger.info("recurring rule saved", { "id": toSave.id });
      res.json({ ok: true, data: toSave });
    } catch (err) {
      logger.error("route.transactions.recurring.save error", { "error": err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── DELETE /api/transactions/recurring/:id ────────────────────

router.delete("/recurring/:id", async (req, res) => {
  await withSpan("route.transactions.recurring.delete", { "id": req.params.id }, async () => {
    try {
      await sheetsRepository.delete("recurring_rules", req.params.id);
      logger.info("recurring rule deleted", { "id": req.params.id });
      res.json({ ok: true });
    } catch (err) {
      logger.error("route.transactions.recurring.delete error", { "error": err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

export default router;