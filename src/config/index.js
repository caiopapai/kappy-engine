// src/config/index.js
// Configuração centralizada lida do .env.
// Todos os módulos importam daqui — nunca process.env directamente.

import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001"),

  sheets: {
    url:    process.env.SHEETS_URL    || "",
    apiKey: process.env.SHEETS_API_KEY || "",
  },

  stocks: {
    provider: process.env.STOCKS_PROVIDER || "brapi",
  },

  brapi: {
    token:   process.env.BRAPI_TOKEN || "",
    baseUrl: "https://brapi.dev/api",
  },
};

// Valida no arranque
export function validateConfig() {
  const warnings = [];

  if (!config.sheets.url)
    warnings.push("SHEETS_URL não configurado — operações de dados vão falhar");
  if (!config.sheets.apiKey)
    warnings.push("SHEETS_API_KEY não configurado — recomendado para segurança");
  if (!config.brapi.token && config.stocks.provider === "brapi")
    warnings.push("BRAPI_TOKEN não configurado — cotações B3 limitadas a ações de teste");

  return warnings;
}
