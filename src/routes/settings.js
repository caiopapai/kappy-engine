// src/routes/settings.js
// Preferências do utilizador persistidas na fonte de dados activa.
// Chaves sensíveis (tokens, api keys) NUNCA passam por aqui — ficam no .env.
//
// GET  /api/settings         → todas as preferências
// POST /api/settings         → actualiza uma ou mais preferências
// GET  /api/settings/:key    → valor de uma chave específica
//
// Schema da aba "settings" na sheet:
//   key   | value
//   ──────┼──────────
//   language  | pt-PT
//   currency  | EUR
//   theme     | dark

import { Router }            from "express";
import { sheetsRepository }  from "../repositories/sheets/SheetsRepository.js";
import { logger }            from "../telemetry/logger.js";
import { withSpan }          from "../telemetry/tracer.js";

const router = Router();

// Chaves permitidas — nunca aceitar api keys ou tokens
const ALLOWED_KEYS = new Set([
  "language",
  "currency",
  "theme",
  "stocks_provider",
  "first_run_done",
]);

// Valores por defeito — aplicados quando a sheet não tem o valor
const DEFAULTS = {
  language:        "pt-BR",
  currency:        "EUR",
  theme:           "dark",
  stocks_provider: "brapi",
  first_run_done:  "false",
};

// ── GET /api/settings ─────────────────────────────────────────

router.get("/", async (req, res) => {
  await withSpan("route.settings.getAll", {}, async () => {
    try {
      const rows = await sheetsRepository.getAll("settings");

      // Constrói objecto key→value a partir das linhas
      const settings = { ...DEFAULTS };
      rows.forEach(r => {
        if (ALLOWED_KEYS.has(r.key)) {
          settings[r.key] = r.value;
        }
      });

      logger.info("settings.getAll", { count: Object.keys(settings).length });
      res.json({ ok: true, data: settings });
    } catch (err) {
      logger.error("settings.getAll error", { error: err.message });
      // Em caso de erro, devolve os defaults — não quebra a app
      res.json({ ok: true, data: DEFAULTS, fromDefaults: true });
    }
  });
});

// ── GET /api/settings/:key ────────────────────────────────────

router.get("/:key", async (req, res) => {
  const { key } = req.params;

  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ ok: false, error: `Chave não permitida: ${key}` });
  }

  await withSpan("route.settings.get", { key }, async () => {
    try {
      const rows = await sheetsRepository.getAll("settings");
      const row  = rows.find(r => r.key === key);
      const value = row?.value ?? DEFAULTS[key] ?? null;

      res.json({ ok: true, key, value });
    } catch (err) {
      logger.error("settings.get error", { key, error: err.message });
      res.json({ ok: true, key, value: DEFAULTS[key] ?? null, fromDefaults: true });
    }
  });
});

// ── POST /api/settings ────────────────────────────────────────

router.post("/", async (req, res) => {
  const updates = req.body; // { language: "en", currency: "USD", ... }

  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ ok: false, error: "Body deve ser objecto { key: value }" });
  }

  // Filtra chaves não permitidas
  const denied = Object.keys(updates).filter(k => !ALLOWED_KEYS.has(k));
  if (denied.length > 0) {
    return res.status(400).json({ ok: false, error: `Chaves não permitidas: ${denied.join(", ")}` });
  }

  await withSpan("route.settings.update", { keys: Object.keys(updates).join(",") }, async () => {
    try {
      // Upsert cada chave
      await Promise.all(
        Object.entries(updates).map(([key, value]) =>
          sheetsRepository.save("settings", { id: key, key, value: String(value) })
        )
      );

      logger.info("settings.update", { keys: Object.keys(updates) });
      res.json({ ok: true, updated: Object.keys(updates) });
    } catch (err) {
      logger.error("settings.update error", { error: err.message });
      res.status(500).json({ ok: false, error: err.message });
    }
  });
});

export default router;
