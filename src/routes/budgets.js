// src/routes/budgets.js
// Endpoint de orçamento com:
//   - Valores planeados (sheet budgets)
//   - Lançamentos reais (sheet transactions)
//   - Projecção de recorrentes (sheet recurring_rules)
//
// GET /api/budgets/summary?year=2025&month=6
//   → Para cada subcategoria com orçamento:
//      { subcategoryId, planned, actual, projected, diff }
//
// GET /api/budgets/summary?year=2025
//   → Resumo anual (12 meses)

import { Router }           from "express";
import { sheetsRepository } from "../repositories/sheets/SheetsRepository.js";
import { logger }           from "../telemetry/logger.js";
import { withSpan }         from "../telemetry/tracer.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────

/**
 * Verifica se uma regra recorrente está activa num dado mês/ano.
 */
function recurringApplies(rule, year, month) {
  if (!rule.active) { return false; }

  const cellDate  = new Date(year, month - 1, 1);
  const startDate = new Date(rule.startDate);
  const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  if (cellDate < startMonth) { return false; }

  if (rule.endDate && !rule.hasNoEnd) {
    const endDate  = new Date(rule.endDate);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    if (cellDate > endMonth) { return false; }
  }

  return true;
}

/**
 * Converte linhas planas da sheet em estrutura { subcategoryId → { months → amount } }
 */
function rowsToBudgetMap(rows) {
  const map = {};
  rows.forEach(r => {
    const subId = parseInt(r.subcategoryId);
    const month = parseInt(r.month);
    const year  = parseInt(r.year);
    if (!map[year])               { map[year] = {}; }
    if (!map[year][subId])        { map[year][subId] = {}; }
    map[year][subId][month] = parseFloat(r.amount) || 0;
  });
  return map;
}

/**
 * Calcula o resumo mensal para um ano/mês.
 * Combina: planeado (budgets) + real (transactions) + projecção (recurring_rules)
 */
function calcMonthSummary(year, month, budgetMap, transactions, recurringRules) {
  const summary = {}; // subcategoryId → { planned, actual, projected }

  // ── Planeado (budgets da sheet) ───────────────────────────
  const yearBudgets = budgetMap[year] || {};
  Object.entries(yearBudgets).forEach(([subId, months]) => {
    const id = parseInt(subId);
    if (!summary[id]) { summary[id] = { planned: 0, actual: 0, projected: 0 }; }
    summary[id].planned = months[month] || 0;
  });

  // ── Real (transações do mês) ───────────────────────────────
  transactions
    .filter(tx => {
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .forEach(tx => {
      const id = parseInt(tx.subcategoryId);
      if (!summary[id]) { summary[id] = { planned: 0, actual: 0, projected: 0 }; }
      summary[id].actual += parseFloat(tx.amount) || 0;
    });

  // ── Projecção (recorrentes activas no mês) ─────────────────
  // Se já há transação real para a subcategoria nesse mês, não projecta
  recurringRules
    .filter(r => recurringApplies(r, year, month))
    .forEach(r => {
      const id = parseInt(r.subcategoryId);
      if (!summary[id]) { summary[id] = { planned: 0, actual: 0, projected: 0 }; }

      // Só projecta se não há lançamento real
      if (summary[id].actual === 0) {
        summary[id].projected += parseFloat(r.amount) || 0;
      }
    });

  // ── Diferença ──────────────────────────────────────────────
  // effective = actual se há lançamentos reais, projected se é futuro/sem lançamentos
  Object.values(summary).forEach(s => {
    s.effective = s.actual > 0 ? s.actual : s.projected;
    s.diff      = s.planned - s.effective; // positivo = sobra, negativo = ultrapassou
  });

  return summary;
}

// ── GET /api/budgets/summary ──────────────────────────────────

router.get("/summary", async (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = req.query.month ? parseInt(req.query.month) : null;

  await withSpan("route.budgets.summary", { year, month: month || "all" }, async () => {
    try {
      // Carrega tudo em paralelo
      const [budgetRows, transactions, recurringRules] = await Promise.all([
        sheetsRepository.getAll("budgets"),
        sheetsRepository.getAll("transactions"),
        sheetsRepository.getAll("recurring_rules"),
      ]);

      const budgetMap = rowsToBudgetMap(budgetRows);

      if (month) {
        // ── Resumo mensal ──────────────────────────────────────
        const summary = calcMonthSummary(year, month, budgetMap, transactions, recurringRules);

        logger.info("budgets.summary.month", { year, month, subcategories: Object.keys(summary).length });
        res.json({ ok: true, year, month, data: summary });

      } else {
        // ── Resumo anual (12 meses) ────────────────────────────
        const annual = {};
        for (let m = 1; m <= 12; m++) {
          annual[m] = calcMonthSummary(year, m, budgetMap, transactions, recurringRules);
        }

        // Totais anuais por subcategoria
        const totals = {};
        Object.entries(annual).forEach(([, monthSummary]) => {
          Object.entries(monthSummary).forEach(([subId, data]) => {
            if (!totals[subId]) { totals[subId] = { planned: 0, actual: 0, projected: 0, effective: 0, diff: 0 }; }
            totals[subId].planned   += data.planned;
            totals[subId].actual    += data.actual;
            totals[subId].projected += data.projected;
            totals[subId].effective += data.effective;
            totals[subId].diff      += data.diff;
          });
        });

        logger.info("budgets.summary.annual", { year, months: 12 });
        res.json({ ok: true, year, monthly: annual, totals });
      }

    } catch (err) {
      logger.error("budgets.summary error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── GET /api/budgets (lista raw — mantém compatibilidade) ─────

router.get("/", async (req, res) => {
  await withSpan("route.budgets.list", {}, async () => {
    try {
      const data = await sheetsRepository.getAll("budgets");
      res.json({ ok: true, data, count: data.length });
    } catch (err) {
      logger.error("route.budgets.list error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── POST /api/budgets ─────────────────────────────────────────

router.post("/", async (req, res) => {
  const { row } = req.body;
  if (!row) {
    return res.status(400).json({ ok: false, error: "'row' obrigatório" });
  }
  await withSpan("route.budgets.save", {}, async () => {
    try {
      const toSave = row.id ? row : { ...row, id: `${row.subcategoryId}_${row.month}_${row.year}` };
      await sheetsRepository.save("budgets", toSave);
      res.json({ ok: true, data: toSave });
    } catch (err) {
      logger.error("route.budgets.save error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// ── DELETE /api/budgets/:id ───────────────────────────────────

router.delete("/:id", async (req, res) => {
  await withSpan("route.budgets.delete", { id: req.params.id }, async () => {
    try {
      await sheetsRepository.delete("budgets", req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error("route.budgets.delete error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

export default router;
