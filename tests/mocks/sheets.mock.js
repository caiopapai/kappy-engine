// tests/mocks/sheets.mock.js
// Dados mock para testes — espelham a estrutura da Google Sheet.

export const MOCK_ACCOUNTS = [
  { id: 1, name: "Conta Principal", type: "checking",    balance: 2450.00, currency: "EUR" },
  { id: 2, name: "Poupança",        type: "savings",     balance: 1800.00, currency: "EUR" },
  { id: 3, name: "Cartão Visa",     type: "credit_card", balance: -320.50, currency: "EUR" },
];

export const MOCK_TRANSACTIONS = [
  { id: 1, accountId: 1, amount: 2800, currency: "EUR", date: "2025-05-01", subcategoryId: 1, notes: "Salário", type: "income" },
  { id: 2, accountId: 1, amount: 850,  currency: "EUR", date: "2025-05-02", subcategoryId: 3, notes: "Renda",   type: "fixed_expense" },
];

export const MOCK_RECURRING_RULES = [
  { id: 1, accountId: 1, amount: 850,  currency: "EUR", subcategoryId: 3, type: "fixed_expense", notes: "Renda",   startDate: "2025-01-01", hasNoEnd: true,  active: true },
  { id: 2, accountId: 1, amount: 2800, currency: "EUR", subcategoryId: 1, type: "income",         notes: "Salário", startDate: "2025-01-01", hasNoEnd: true,  active: true },
];

export const MOCK_BRAPI_SEARCH = {
  stocks: [
    { stock: "PETR4", name: "Petrobras PN",     close: 38.50, type: "stock" },
    { stock: "VALE3", name: "Vale ON",           close: 61.20, type: "stock" },
    { stock: "MGLU3", name: "Magazine Luiza ON", close: 8.90,  type: "stock" },
  ],
};

export const MOCK_BRAPI_SEARCH_WITH_INACTIVE = {
  stocks: [
    { stock: "PETR4", name: "Petrobras PN",     close: 38.50, type: "stock" },
    { stock: "XXXX3", name: "Empresa Inativa",  close: 0,     type: "stock" }, // preço zero → filtrar
    { stock: "",      name: "Sem ticker",        close: 10,    type: "stock" }, // sem ticker → filtrar
    { stock: "VALE3", name: "",                  close: 61.20, type: "stock" }, // sem nome → filtrar
  ],
};

export const MOCK_BRAPI_QUOTE = {
  results: [
    {
      symbol:                    "PETR4",
      shortName:                 "PETROBRAS PN",
      regularMarketPrice:        38.50,
      regularMarketChange:       0.30,
      regularMarketChangePercent:0.78,
      regularMarketVolume:       45678901,
      regularMarketDayHigh:      39.00,
      regularMarketDayLow:       38.20,
      regularMarketTime:         "2025-05-01T17:08:00.000Z",
    },
  ],
};

export const MOCK_BRAPI_QUOTE_NULL_PRICE = {
  results: [
    {
      symbol:             "SUSP3",
      shortName:          "Empresa Suspensa",
      regularMarketPrice: null,  // suspenso → filtrar
    },
  ],
};

export const MOCK_SHEETS_OK = (data) => ({
  ok:    true,
  data,
  count: Array.isArray(data) ? data.length : 1,
});

export const MOCK_SHEETS_ERROR = (error = "Erro interno") => ({
  ok: false,
  error,
});
