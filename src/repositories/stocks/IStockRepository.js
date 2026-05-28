// src/repositories/stocks/IStockRepository.js
// Contrato que todos os providers de cotações devem implementar.
// Para adicionar um novo provider (ex: Yahoo Finance, Alpha Vantage):
//   1. Cria XxxRepository.js que implementa estes métodos
//   2. Regista em StockRepositoryFactory.js
//   3. Adiciona STOCKS_PROVIDER=xxx ao .env

export class IStockRepository {
  /**
   * Pesquisa ativos por ticker ou nome.
   * @param {string} query - Termo de pesquisa (ex: "PETR", "Petrobras")
   * @param {string} type  - Tipo de ativo: "stock" | "fii" | "bdr" | "all"
   * @returns {Promise<Array<{ ticker, name, type, price, change }>>}
   */
  async search(query, type = "all") {
    throw new Error("search() não implementado");
  }

  /**
   * Obtém a cotação actual de um ou mais tickers.
   * @param {string|string[]} tickers - Ex: "PETR4" ou ["PETR4", "VALE3"]
   * @returns {Promise<Array<{ ticker, name, price, currency, change, changePercent, volume, source }>>}
   */
  async getQuote(tickers) {
    throw new Error("getQuote() não implementado");
  }

  /**
   * Nome do provider (para logs e UI).
   * @returns {string}
   */
  get name() {
    return "unknown";
  }
}
