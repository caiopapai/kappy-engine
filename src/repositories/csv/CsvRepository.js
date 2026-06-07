// src/repositories/csv/CsvRepository.js
// Repositório de dados baseado em ficheiros CSV locais.
// Implementa a mesma interface do SheetsRepository para ser
// completamente intercambiável via DATA_PROVIDER=csv.
//
// Estrutura de ficheiros:
//   CSV_DIR/accounts.csv
//   CSV_DIR/categories.csv
//   ... etc.
//
// Formato CSV: primeira linha = headers, restantes = dados.
// Separador: vírgula. Encoding: UTF-8 com BOM.
//
// ⚠️ LIMITAÇÕES:
//   - Sem controlo de concorrência
//   - Sem transacções atómicas
//   - Sem relações entre ficheiros
//   - Performance limitada em ficheiros grandes

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join }  from "path";
import { config } from "../../config/index.js";
import { logger } from "../../telemetry/logger.js";

// ── Helpers CSV ───────────────────────────────────────────────

function escapeField(value) {
  if (value == null) return "";
  const str = String(value);
  // Envolve em aspas se contiver vírgula, aspas ou newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function parseCSVLine(line) {
  const fields = [];
  let current  = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(content) {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows    = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row    = {};
    headers.forEach((h, idx) => {
      const val = values[idx] ?? "";
      // Converte números e booleans
      if (val === "true")  row[h] = true;
      else if (val === "false") row[h] = false;
      else if (val !== "" && !isNaN(Number(val))) row[h] = Number(val);
      else row[h] = val;
    });
    // Só inclui linhas com id válido
    if (row.id !== "" && row.id != null) rows.push(row);
  }

  return rows;
}

function serializeCSV(rows, headers) {
  if (rows.length === 0) return headers.join(",") + "\n";
  const lines = [headers.join(",")];
  rows.forEach(row => {
    const line = headers.map(h => escapeField(row[h])).join(",");
    lines.push(line);
  });
  return lines.join("\n") + "\n";
}

// Headers por entidade — devem corresponder ao SHEETS_CONFIG do Apps Script
const ENTITY_HEADERS = {
  accounts:       ["id", "name", "type", "balance", "currency"],
  categories:     ["id", "name", "type"],
  subcategories:  ["id", "categoryId", "name", "type"],
  transactions:   ["id", "accountId", "amount", "currency", "date", "subcategoryId", "notes", "type", "recurring"],
  recurring_rules:["id", "accountId", "amount", "currency", "subcategoryId", "type", "notes", "startDate", "endDate", "hasNoEnd", "active"],
  investments:    ["id", "accountId", "opType", "assetType", "exchange", "ticker", "name", "date", "quantity", "unitPrice", "otherCosts", "currency", "totalValue", "dyAnnual"],
  goals:          ["id", "type", "label", "targetValue", "currentValue", "currency", "accountIds"],
  budgets:        ["id", "year", "subcategoryId", "month", "amount"],
  settings:       ["id", "key", "value"],
};

// ── Repository ────────────────────────────────────────────────

export class CsvRepository {
  constructor() {
    this.dir = config.csv?.dir || "./data";
    // Cria o directório se não existir
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
      logger.info("csv.dir created", { dir: this.dir });
    }
  }

  #filePath(entity) {
    return join(this.dir, `${entity}.csv`);
  }

  #read(entity) {
    const path = this.#filePath(entity);
    if (!existsSync(path)) {
      // Cria ficheiro com headers se não existir
      const headers = ENTITY_HEADERS[entity] || ["id"];
      writeFileSync(path, headers.join(",") + "\n", "utf8");
      logger.info("csv.file created", { entity, path });
      return [];
    }
    const content = readFileSync(path, "utf8");
    return parseCSV(content);
  }

  #write(entity, rows) {
    const path    = this.#filePath(entity);
    const headers = ENTITY_HEADERS[entity] || Object.keys(rows[0] || { id: "" });
    // Garante que todos os rows têm os headers correctos
    const normalized = rows.map(row => {
      const normalized = {};
      headers.forEach(h => { normalized[h] = row[h] ?? ""; });
      return normalized;
    });
    writeFileSync(path, serializeCSV(normalized, headers), "utf8");
  }

  // ── Interface pública (igual ao SheetsRepository) ────────────

  async getAll(entity) {
    try {
      const rows = this.#read(entity);
      logger.info("csv.getAll", { entity, count: rows.length });
      return rows;
    } catch (err) {
      logger.error("csv.getAll error", { entity, error: err.message });
      throw new Error(`Erro ao ler ${entity}.csv: ${err.message}`);
    }
  }

  async save(entity, row) {
    try {
      const rows    = this.#read(entity);
      const idx     = rows.findIndex(r => String(r.id) === String(row.id));
      const toSave  = { ...row, id: row.id || Date.now() };

      if (idx >= 0) {
        rows[idx] = toSave;
      } else {
        rows.push(toSave);
      }

      this.#write(entity, rows);
      logger.info("csv.save", { entity, id: toSave.id });
      return { ok: true };
    } catch (err) {
      logger.error("csv.save error", { entity, error: err.message });
      throw new Error(`Erro ao guardar em ${entity}.csv: ${err.message}`);
    }
  }

  async delete(entity, id) {
    try {
      const rows    = this.#read(entity);
      const filtered = rows.filter(r => String(r.id) !== String(id));

      if (filtered.length === rows.length) {
        logger.warn("csv.delete not found", { entity, id });
      }

      this.#write(entity, filtered);
      logger.info("csv.delete", { entity, id });
      return { ok: true };
    } catch (err) {
      logger.error("csv.delete error", { entity, error: err.message });
      throw new Error(`Erro ao apagar de ${entity}.csv: ${err.message}`);
    }
  }

  async bulkSave(entity, rows) {
    try {
      const existing = this.#read(entity);
      const map      = new Map(existing.map(r => [String(r.id), r]));

      rows.forEach(row => {
        const toSave = { ...row, id: row.id || Date.now() };
        map.set(String(toSave.id), toSave);
      });

      this.#write(entity, Array.from(map.values()));
      logger.info("csv.bulkSave", { entity, count: rows.length });
      return { ok: true };
    } catch (err) {
      logger.error("csv.bulkSave error", { entity, error: err.message });
      throw new Error(`Erro no bulk save em ${entity}.csv: ${err.message}`);
    }
  }

  // ── Shortcuts ─────────────────────────────────────────────────
  accounts()      { return this.getAll("accounts"); }
  categories()    { return this.getAll("categories"); }
  subcategories() { return this.getAll("subcategories"); }
  transactions()  { return this.getAll("transactions"); }
  investments()   { return this.getAll("investments"); }
  goals()         { return this.getAll("goals"); }
  budgets()       { return this.getAll("budgets"); }
}

export const csvRepository = new CsvRepository();