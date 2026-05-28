// src/routes/sheets.js
// Proxy seguro para o Google Apps Script.
// O frontend chama /api/sheets/* — as credenciais nunca saem do engine.
//
// GET    /api/sheets/:entity          → lista todos
// GET    /api/sheets/:entity/:id      → busca por id
// POST   /api/sheets/:entity          → cria ou actualiza (upsert)
// DELETE /api/sheets/:entity/:id      → elimina por id

import { Router } from "express";
import { sheetsRepository } from "../repositories/sheets/SheetsRepository.js";

const router = Router();

const ALLOWED_ENTITIES = [
  "accounts", "categories", "subcategories",
  "transactions", "recurring_rules", "budgets",
  "investments", "goals",
];

function validateEntity(req, res, next) {
  if (!ALLOWED_ENTITIES.includes(req.params.entity)) {
    return res.status(400).json({ ok: false, error: `Entidade inválida: ${req.params.entity}` });
  }
  next();
}

// GET /api/sheets/:entity
router.get("/:entity", validateEntity, async (req, res) => {
  try {
    const data = await sheetsRepository.getAll(req.params.entity);
    res.json({ ok: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/sheets/:entity/:id
router.get("/:entity/:id", validateEntity, async (req, res) => {
  try {
    const data = await sheetsRepository.getById(req.params.entity, req.params.id);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});

// POST /api/sheets/:entity
router.post("/:entity", validateEntity, async (req, res) => {
  const { row, rows, action } = req.body;

  try {
    let result;
    if (action === "bulk" || rows) {
      result = await sheetsRepository.bulkSave(req.params.entity, rows);
    } else {
      result = await sheetsRepository.save(req.params.entity, row || req.body);
    }
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/sheets/:entity/:id
router.delete("/:entity/:id", validateEntity, async (req, res) => {
  try {
    await sheetsRepository.delete(req.params.entity, req.params.id);
    res.json({ ok: true, message: `Eliminado id=${req.params.id}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
