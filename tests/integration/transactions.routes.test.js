// tests/integration/transactions.routes.test.js
import request from "supertest";
import express from "express";
import transactionsRouter from "../../src/routes/transactions.js";
import { errorHandler, notFound } from "../../src/middleware/errorHandler.js";
import {
  MOCK_ACCOUNTS,
  MOCK_TRANSACTIONS,
  MOCK_RECURRING_RULES,
  MOCK_SHEETS_OK,
  MOCK_SHEETS_ERROR,
} from "../mocks/sheets.mock.js";
import { mockFetchOk, mockFetchNetworkError, mockFetchSequence } from "../mocks/fetch.mock.js";

jest.mock("../../src/telemetry/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../src/telemetry/tracer.js", () => ({
  withSpan: async (_n, _a, fn) => fn({ setAttribute: jest.fn() }),
  SpanStatusCode: { OK: "OK", ERROR: "ERROR" },
}));
jest.mock("../../src/config/index.js", () => ({
  config: {
    sheets: { url: "https://script.google.com/test", apiKey: "test-key" },
  },
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/transactions", transactionsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// ── GET /api/transactions ─────────────────────────────────────

describe("GET /api/transactions", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 devolve lista de transações", async () => {
    global.fetch = mockFetchOk(MOCK_SHEETS_OK(MOCK_TRANSACTIONS));
    const res = await request(makeApp()).get("/api/transactions");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual(MOCK_TRANSACTIONS);
  });

  test("500 quando sheets falha", async () => {
    global.fetch = mockFetchNetworkError();
    const res = await request(makeApp()).get("/api/transactions");
    expect(res.status).toBe(500);
  });
});

// ── GET /api/transactions/recurring ──────────────────────────

describe("GET /api/transactions/recurring", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 devolve lista de regras recorrentes", async () => {
    global.fetch = mockFetchOk(MOCK_SHEETS_OK(MOCK_RECURRING_RULES));
    const res = await request(makeApp()).get("/api/transactions/recurring");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual(MOCK_RECURRING_RULES);
  });
});

// ── POST /api/transactions ────────────────────────────────────

describe("POST /api/transactions", () => {
  beforeEach(() => jest.clearAllMocks());

  const newIncomeTx = {
    accountId:     1,
    amount:        2800,
    currency:      "EUR",
    date:          "2025-06-01",
    subcategoryId: 1,
    notes:         "Salário Junho",
    type:          "income",
    recurring:     false,
  };

  const newExpenseTx = {
    accountId:     1,
    amount:        120,
    currency:      "EUR",
    date:          "2025-06-02",
    subcategoryId: 3,
    notes:         "Supermercado",
    type:          "variable_expense",
    recurring:     false,
  };

  test("200 cria transação e actualiza saldo da conta", async () => {
    // Sequência: 1) save tx  2) getAll accounts  3) save account
    global.fetch = mockFetchSequence([
      { body: { ok: true, data: { ...newIncomeTx, id: 999 } } },         // save tx
      { body: MOCK_SHEETS_OK(MOCK_ACCOUNTS) },                             // getAll accounts
      { body: { ok: true, data: { ...MOCK_ACCOUNTS[0], balance: 5250 } } }, // save account
    ]);

    const res = await request(makeApp())
      .post("/api/transactions")
      .send({ transaction: newIncomeTx });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Verificar que foram feitas 3 chamadas ao fetch
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test("saldo aumenta para transação do tipo income", async () => {
    global.fetch = mockFetchSequence([
      { body: { ok: true, data: { ...newIncomeTx, id: 999 } } },
      { body: MOCK_SHEETS_OK(MOCK_ACCOUNTS) },
      { body: { ok: true } },
    ]);

    await request(makeApp()).post("/api/transactions").send({ transaction: newIncomeTx });

    // Terceira chamada é o save da conta — verificar o novo saldo
    const accountSaveBody = JSON.parse(global.fetch.mock.calls[2][1].body);
    const savedAccount    = accountSaveBody.row;
    // Saldo original: 2450, income +2800 → 5250
    expect(savedAccount.balance).toBe(2450 + 2800);
  });

  test("saldo diminui para transação de despesa", async () => {
    global.fetch = mockFetchSequence([
      { body: { ok: true, data: { ...newExpenseTx, id: 998 } } },
      { body: MOCK_SHEETS_OK(MOCK_ACCOUNTS) },
      { body: { ok: true } },
    ]);

    await request(makeApp()).post("/api/transactions").send({ transaction: newExpenseTx });

    const accountSaveBody = JSON.parse(global.fetch.mock.calls[2][1].body);
    const savedAccount    = accountSaveBody.row;
    // Saldo original: 2450, expense -120 → 2330
    expect(savedAccount.balance).toBe(2450 - 120);
  });

  test("não actualiza saldo quando transação tem id (edição)", async () => {
    const existingTx = { ...newIncomeTx, id: 1 }; // id existente = edição
    global.fetch = mockFetchOk({ ok: true, data: existingTx });

    await request(makeApp()).post("/api/transactions").send({ transaction: existingTx });

    // Só 1 chamada (save tx) — não busca nem actualiza conta
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("400 sem transaction no body", async () => {
    const res = await request(makeApp()).post("/api/transactions").send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test("400 sem accountId", async () => {
    const res = await request(makeApp())
      .post("/api/transactions")
      .send({ transaction: { amount: 100, type: "income" } });
    expect(res.status).toBe(400);
  });

  test("400 sem amount", async () => {
    const res = await request(makeApp())
      .post("/api/transactions")
      .send({ transaction: { accountId: 1, type: "income" } });
    expect(res.status).toBe(400);
  });

  test("500 quando save da transação falha", async () => {
    global.fetch = mockFetchOk(MOCK_SHEETS_ERROR("Erro ao guardar"));
    const res = await request(makeApp())
      .post("/api/transactions")
      .send({ transaction: newIncomeTx });

    expect(res.status).toBe(500);
  });

  test("atribui id automático quando não fornecido", async () => {
    global.fetch = mockFetchSequence([
      { body: { ok: true, data: { ...newIncomeTx, id: 12345 } } },
      { body: MOCK_SHEETS_OK(MOCK_ACCOUNTS) },
      { body: { ok: true } },
    ]);

    await request(makeApp()).post("/api/transactions").send({ transaction: newIncomeTx });

    const saveTxBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(saveTxBody.row.id).toBeDefined();
    expect(typeof saveTxBody.row.id).toBe("number");
  });
});

// ── DELETE /api/transactions/:id ──────────────────────────────

describe("DELETE /api/transactions/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 elimina transação e reverte saldo da conta", async () => {
    // Sequência: 1) getAll tx  2) delete tx  3) getAll accounts  4) save account
    global.fetch = mockFetchSequence([
      { body: MOCK_SHEETS_OK(MOCK_TRANSACTIONS) },   // getAll tx
      { body: { ok: true } },                         // delete tx
      { body: MOCK_SHEETS_OK(MOCK_ACCOUNTS) },        // getAll accounts
      { body: { ok: true } },                         // save account com saldo revertido
    ]);

    const res = await request(makeApp()).delete("/api/transactions/1");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  test("saldo é revertido correctamente ao eliminar income", async () => {
    // tx id=1 é income de 2800
    global.fetch = mockFetchSequence([
      { body: MOCK_SHEETS_OK(MOCK_TRANSACTIONS) },
      { body: { ok: true } },
      { body: MOCK_SHEETS_OK(MOCK_ACCOUNTS) },
      { body: { ok: true } },
    ]);

    await request(makeApp()).delete("/api/transactions/1");

    const accountSaveBody = JSON.parse(global.fetch.mock.calls[3][1].body);
    const savedAccount    = accountSaveBody.row;
    // Saldo original: 2450, reverter income 2800 → 2450 - 2800 = -350
    expect(savedAccount.balance).toBe(2450 - 2800);
  });

  test("saldo é revertido correctamente ao eliminar expense", async () => {
    // tx id=2 é fixed_expense de 850
    global.fetch = mockFetchSequence([
      { body: MOCK_SHEETS_OK(MOCK_TRANSACTIONS) },
      { body: { ok: true } },
      { body: MOCK_SHEETS_OK(MOCK_ACCOUNTS) },
      { body: { ok: true } },
    ]);

    await request(makeApp()).delete("/api/transactions/2");

    const accountSaveBody = JSON.parse(global.fetch.mock.calls[3][1].body);
    const savedAccount    = accountSaveBody.row;
    // Saldo original: 2450, reverter expense 850 → 2450 + 850 = 3300
    expect(savedAccount.balance).toBe(2450 + 850);
  });

  test("404 quando transação não existe", async () => {
    global.fetch = mockFetchSequence([
      { body: MOCK_SHEETS_OK(MOCK_TRANSACTIONS) }, // getAll tx — não contém id 999
    ]);

    const res = await request(makeApp()).delete("/api/transactions/999");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  test("500 quando fetch falha ao ler transações", async () => {
    global.fetch = mockFetchNetworkError();
    const res = await request(makeApp()).delete("/api/transactions/1");
    expect(res.status).toBe(500);
  });
});

// ── POST /api/transactions/recurring ─────────────────────────

describe("POST /api/transactions/recurring", () => {
  beforeEach(() => jest.clearAllMocks());

  const newRule = {
    accountId:     1,
    amount:        500,
    currency:      "EUR",
    subcategoryId: 3,
    type:          "fixed_expense",
    notes:         "Internet",
    startDate:     "2025-06-01",
    hasNoEnd:      true,
    active:        true,
  };

  test("200 cria regra recorrente", async () => {
    global.fetch = mockFetchOk({ ok: true, data: { ...newRule, id: 999 } });
    const res = await request(makeApp())
      .post("/api/transactions/recurring")
      .send({ rule: newRule });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("atribui id automático quando não fornecido", async () => {
    global.fetch = mockFetchOk({ ok: true, data: { ...newRule, id: 12345 } });
    await request(makeApp()).post("/api/transactions/recurring").send({ rule: newRule });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.row.id).toBeDefined();
  });

  test("400 sem rule no body", async () => {
    const res = await request(makeApp()).post("/api/transactions/recurring").send({});
    expect(res.status).toBe(400);
  });

  test("400 sem accountId", async () => {
    const res = await request(makeApp())
      .post("/api/transactions/recurring")
      .send({ rule: { amount: 100 } });
    expect(res.status).toBe(400);
  });

  test("500 quando sheets falha", async () => {
    global.fetch = mockFetchOk(MOCK_SHEETS_ERROR("Erro"));
    const res = await request(makeApp())
      .post("/api/transactions/recurring")
      .send({ rule: newRule });
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/transactions/recurring/:id ────────────────────

describe("DELETE /api/transactions/recurring/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 elimina regra recorrente", async () => {
    global.fetch = mockFetchOk({ ok: true });
    const res = await request(makeApp()).delete("/api/transactions/recurring/1");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("500 quando sheets falha", async () => {
    global.fetch = mockFetchNetworkError();
    const res = await request(makeApp()).delete("/api/transactions/recurring/1");
    expect(res.status).toBe(500);
  });
});
