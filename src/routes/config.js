// src/routes/config.js
// Expõe a configuração activa do engine ao frontend.
// O frontend usa isto para saber qual o provider de dados e se está operacional.

import { Router }           from "express";
import { config }           from "../config/index.js";
import { sheetsRepository } from "../repositories/sheets/SheetsRepository.js";
import { logger }           from "../telemetry/logger.js";

const router = Router();

// ── GET /api/config ───────────────────────────────────────────
// Devolve o provider activo e o estado da ligação.
//
// Response:
// {
//   ok: true,
//   provider: "google_sheets",       ← provider activo
//   providerLabel: "Google Sheets",  ← nome legível
//   connected: true,                 ← ligação testada
//   error: null,                     ← mensagem de erro se não conectado
//   stocks: "brapi"                  ← provider de cotações
// }

const PROVIDERS = {
  google_sheets: { label: "Google Sheets", icon: "📗" },
  excel_365:     { label: "Excel 365",     icon: "📘" },
  local_sqlite:  { label: "SQLite Local",  icon: "🗄" },
  postgres:      { label: "PostgreSQL",    icon: "🐘" },
  mongodb:       { label: "MongoDB",       icon: "🍃" },
};

router.get("/", async (req, res) => {
  // Provider activo vem da config do engine
  const provider = config.dataProvider || "google_sheets";
  const info     = PROVIDERS[provider] || { label: provider, icon: "💾" };

  let connected = false;
  let error     = null;

  try {
    // Testa a ligação ao provider activo
    await sheetsRepository.getAll("accounts");
    connected = true;
  } catch (err) {
    error = err.message;
    logger.warn("config.test connection failed", { provider, error: err.message });
  }

  res.json({
    ok:            true,
    provider,
    providerLabel: info.label,
    providerIcon:  info.icon,
    connected,
    error,
    stocks:        config.stocks.provider,
  });
});

export default router;
