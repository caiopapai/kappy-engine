// src/repositories/sheets/SheetsRepository.js
import { config }   from "../../config/index.js";
import { logger }   from "../../telemetry/logger.js";
import { withSpan } from "../../telemetry/tracer.js";

export class SheetsRepository {

  #get(sheet, id = null) {
    return withSpan("sheets.get", { "sheet": sheet, ...(id && { "id": String(id) }) }, async () => {
      const params = new URLSearchParams({ sheet, key: config.sheets.apiKey });
      if (id) {
        params.append("id", id);
      }

      logger.info("sheets.get request", { "sheet": sheet });

      const res  = await fetch(`${config.sheets.url}?${params}`);
      const data = await res.json();

      if (!data.ok) {
        logger.error("sheets.get failed", { "sheet": sheet, "error": data.error });
        throw new Error(data.error || `Erro ao ler ${sheet}`);
      }

      logger.info("sheets.get success", { "sheet": sheet, "count": data.data?.length ?? 1 });
      return data.data;
    });
  }

  #post(body) {
    return withSpan("sheets.post", { "action": body.action, "sheet": body.sheet }, async () => {
      logger.info("sheets.post request", { "action": body.action, "sheet": body.sheet });

      const res = await fetch(config.sheets.url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...body, key: config.sheets.apiKey }),
      });
      const data = await res.json();

      if (!data.ok) {
        logger.error("sheets.post failed", { "action": body.action, "sheet": body.sheet, "error": data.error });
        throw new Error(data.error || "Erro na operação");
      }

      logger.info("sheets.post success", { "action": body.action, "sheet": body.sheet });
      return data;
    });
  }

  getAll(sheet)         { return this.#get(sheet); }
  getById(sheet, id)    { return this.#get(sheet, id); }
  save(sheet, row)      { return this.#post({ action: "upsert",      sheet, row }); }
  delete(sheet, id)     { return this.#post({ action: "delete",      sheet, id }); }
  bulkSave(sheet, rows) { return this.#post({ action: "bulk_upsert", sheet, rows }); }
  clear(sheet)          { return this.#post({ action: "delete_all",  sheet }); }

  accounts()      { return this.getAll("accounts"); }
  categories()    { return this.getAll("categories"); }
  subcategories() { return this.getAll("subcategories"); }
  transactions()  { return this.getAll("transactions"); }
  investments()   { return this.getAll("investments"); }
  goals()         { return this.getAll("goals"); }
  budgets()       { return this.getAll("budgets"); }
}

export const sheetsRepository = new SheetsRepository();
