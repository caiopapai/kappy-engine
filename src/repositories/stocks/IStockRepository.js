export class IStockRepository {
  /**
   * Pesquisa ativos por ticker ou nome.
   * @param {string} _query - Termo de pesquisa
   * @param {string} _type  - Tipo: "stock" | "fii" | "bdr" | "all"
   * @returns {Promise<Array<{ ticker, name, type, price, change }>>}
   */
  search(_query, _type = "all") {
    return Promise.reject(new Error("search() não implementado"));
  }

  /**
   * Obtém a cotação actual de um ou mais tickers.
   * @param {string|string[]} _tickers
   * @returns {Promise<Array<{ ticker, name, price, currency, change, source }>>}
   */
  getQuote(_tickers) {
    return Promise.reject(new Error("getQuote() não implementado"));
  }

  /**
   * Nome do provider.
   * @returns {string}
   */
  get name() {
    return "unknown";
  }
}
