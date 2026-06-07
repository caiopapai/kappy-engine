// src/repositories/RepositoryFactory.js
// Selecciona o repositório activo com base em DATA_PROVIDER.
//
// DATA_PROVIDER=google_sheets → SheetsRepository
// DATA_PROVIDER=csv           → CsvRepository

import { config }          from "../config/index.js";
import { SheetsRepository } from "./sheets/SheetsRepository.js";
import { CsvRepository }    from "./csv/CsvRepository.js";

function createRepository() {
  const provider = config.dataProvider || "google_sheets";

  switch (provider) {
    case "csv":
      return new CsvRepository();
    case "google_sheets":
    default:
      return new SheetsRepository();
  }
}

export const repository = createRepository();