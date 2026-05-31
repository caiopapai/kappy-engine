import { Router }              from "express";
import { sheetsRepository }    from "../repositories/sheets/SheetsRepository.js";
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

  if (!transaction || !transaction.accountId || !transaction.amount) {
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

      // Guarda a transação
      await sheetsRepository.save("transactions", toSave);
      logger.info("transaction saved", { "id": toSave.id, "type": toSave.type, "amount": amount });

      // Actualiza saldo da conta (só em novas transações)
      if (isNew) {
        const accounts = await sheetsRepository.getAll("accounts");
        const account  = accounts.find(a => a.id === toSave.accountId);

        if (account) {
          const newBalance = account.balance + (isPos ? amount : -amount);
          await sheetsRepository.save("accounts", { ...account, balance: newBalance });
          logger.info("account balance updated", {
            "accountId":  account.id,
            "oldBalance": account.balance,
            "newBalance": newBalance,
            "delta":      isPos ? amount : -amount,
          });
        } else {
          logger.warn("account not found for balance update", { "accountId": toSave.accountId });
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

      const isPos  = transaction.type === "income";
      const amount = parseFloat(transaction.amount);

      // Apaga a transação
      await sheetsRepository.delete("transactions", id);
      logger.info("transaction deleted", { "id": id, "type": transaction.type, "amount": amount });

      // Reverte saldo da conta
      const accounts = await sheetsRepository.getAll("accounts");
      const account  = accounts.find(a => a.id === transaction.accountId);

      if (account) {
        // Reverter: se era income subtrai, se era expense adiciona
        const newBalance = account.balance - (isPos ? amount : -amount);
        await sheetsRepository.save("accounts", { ...account, balance: newBalance });
        logger.info("account balance reverted", {
          "accountId":  account.id,
          "oldBalance": account.balance,
          "newBalance": newBalance,
        });
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