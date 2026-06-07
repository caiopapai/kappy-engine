// src/routes/autoCategories.js
// Cria automaticamente categorias e subcategorias para empréstimos e cartões.
//
// Empréstimo:
//   Categoria:    "Empréstimos"     (fixed_expense)
//   Subcategoria: "Conta - Nome"    (ex: "NuBank - Crédito Habitação")
//
// Cartão:
//   Categoria:    "Cartões"         (variable_expense)
//   Subcategoria: "Conta - Nome"    (ex: "NuBank - Visa NuBank")

import { repository } from "../repositories/RepositoryFactory.js";
import { logger }     from "../telemetry/logger.js";

// Encontra ou cria uma categoria
async function findOrCreateCategory(name, type) {
  const categories = await repository.getAll("categories");
  let cat = categories.find(c => c.name === name && c.type === type);
  if (!cat) {
    cat = { id: Date.now(), name, type };
    await repository.save("categories", cat);
    logger.info("autoCategory.created", { name, type });
  }
  return cat;
}

// Encontra ou cria uma subcategoria
async function findOrCreateSubcategory(name, categoryId, type) {
  const subcategories = await repository.getAll("subcategories");
  let sub = subcategories.find(s => s.name === name && s.categoryId === categoryId);
  if (!sub) {
    sub = { id: Date.now() + 1, name, categoryId, type };
    await repository.save("subcategories", sub);
    logger.info("autoCategory.subcreated", { name, categoryId });
  }
  return sub;
}

// Para empréstimos — cria categoria + subcategoria + regra recorrente
export async function setupLoanCategories(loan, accountName) {
  if (!loan.installment) return null;

  const subName = `${accountName} - ${loan.name}`;
  const cat     = await findOrCreateCategory("Empréstimos", "fixed_expense");
  const sub     = await findOrCreateSubcategory(subName, cat.id, "fixed_expense");

  // Cria/actualiza regra recorrente
  const ruleId = `loan_${loan.id}`;
  const rule = {
    id:            ruleId,
    accountId:     loan.accountId,
    entityType:    "loan",
    entityId:      String(loan.id),
    amount:        parseFloat(loan.installment),
    currency:      loan.currency,
    subcategoryId: sub.id,
    type:          "fixed_expense",
    notes:         loan.name,
    startDate:     loan.start_date || new Date().toISOString().slice(0, 10),
    endDate:       loan.end_date   || "",
    hasNoEnd:      !loan.end_date,
    active:        true,
  };

  await repository.save("recurring_rules", rule);
  logger.info("autoCategory.loanRule created", { ruleId, loanId: loan.id, subName });

  return { category: cat, subcategory: sub, rule };
}

// Para cartões — cria categoria + subcategoria
export async function setupCardCategories(card, accountName) {
  const subName = `${accountName} - ${card.name}`;
  const cat     = await findOrCreateCategory("Cartões", "variable_expense");
  const sub     = await findOrCreateSubcategory(subName, cat.id, "variable_expense");

  logger.info("autoCategory.cardSetup", { cardId: card.id, subName });
  return { category: cat, subcategory: sub };
}