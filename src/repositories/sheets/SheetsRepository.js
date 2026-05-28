// src/repositories/sheets/SheetsRepository.js
// Proxy seguro para o Google Apps Script.
// O frontend nunca chama o Apps Script directamente —
// todas as chamadas passam por aqui, onde as credenciais estão protegidas.

import { config } from "../../config/index.js";

export class SheetsRepository {

  // ── Primitivas ────────────────────────────────────────────

  async #get(sheet, id = null) {
    const params = new URLSearchParams({ sheet, key: config.sheets.apiKey });
    if (id) params.append("id", id);

    const res  = await fetch(`${config.sheets.url}?${params}`);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || `Erro ao ler ${sheet}`);
    return data.data;
  }

  async #post(body) {
    const res = await fetch(config.sheets.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, key: config.sheets.apiKey }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Erro na operação");
    return data;
  }

  // ── API pública ───────────────────────────────────────────

  getAll(sheet)          { return this.#get(sheet); }
  getById(sheet, id)     { return this.#get(sheet, id); }
  save(sheet, row)       { return this.#post({ action: "upsert",      sheet, row }); }
  delete(sheet, id)      { return this.#post({ action: "delete",      sheet, id }); }
  bulkSave(sheet, rows)  { return this.#post({ action: "bulk_upsert", sheet, rows }); }
  clear(sheet)           { return this.#post({ action: "delete_all",  sheet }); }

  // ── Atalhos por entidade ──────────────────────────────────

  accounts()      { return this.getAll("accounts"); }
  categories()    { return this.getAll("categories"); }
  subcategories() { return this.getAll("subcategories"); }
  transactions()  { return this.getAll("transactions"); }
  investments()   { return this.getAll("investments"); }
  goals()         { return this.getAll("goals"); }
  budgets()       { return this.getAll("budgets"); }
}

// Singleton
export const sheetsRepository = new SheetsRepository();
