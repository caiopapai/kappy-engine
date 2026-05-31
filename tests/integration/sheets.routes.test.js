// tests/integration/sheets.routes.test.js
import request  from "supertest";
import express  from "express";
import sheetsRouter from "../../src/routes/sheets.js";
import { errorHandler, notFound } from "../../src/middleware/errorHandler.js";
import { MOCK_ACCOUNTS, MOCK_SHEETS_OK, MOCK_SHEETS_ERROR } from "../mocks/sheets.mock.js";
import { mockFetchOk, mockFetchNetworkError } from "../mocks/fetch.mock.js";

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
  app.use("/api/sheets", sheetsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe("GET /api/sheets/:entity", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 devolve lista de registos", async () => {
    global.fetch = mockFetchOk(MOCK_SHEETS_OK(MOCK_ACCOUNTS));
    const res = await request(makeApp()).get("/api/sheets/accounts");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual(MOCK_ACCOUNTS);
    expect(res.body.count).toBe(3);
  });

  test("400 para entidade inválida", async () => {
    const res = await request(makeApp()).get("/api/sheets/invalid_entity");
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test("500 quando Apps Script devolve erro", async () => {
    global.fetch = mockFetchOk(MOCK_SHEETS_ERROR("Aba não encontrada"));
    const res = await request(makeApp()).get("/api/sheets/accounts");

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe("Aba não encontrada");
  });

  test("500 quando fetch falha", async () => {
    global.fetch = mockFetchNetworkError();
    const res = await request(makeApp()).get("/api/sheets/accounts");

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });

  test("envia a API key na chamada ao Apps Script", async () => {
    global.fetch = mockFetchOk(MOCK_SHEETS_OK([]));
    await request(makeApp()).get("/api/sheets/goals");

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("key=test-key");
  });

  test("todas as entidades válidas são aceites", async () => {
    const entities = ["accounts","categories","subcategories","transactions","recurring_rules","budgets","investments","goals"];

    for (const entity of entities) {
      global.fetch = mockFetchOk(MOCK_SHEETS_OK([]));
      const res = await request(makeApp()).get(`/api/sheets/${entity}`);
      expect(res.status).toBe(200);
    }
  });
});

describe("POST /api/sheets/:entity", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 faz upsert de um registo", async () => {
    const account = MOCK_ACCOUNTS[0];
    global.fetch  = mockFetchOk({ ok: true, data: account });
    const res     = await request(makeApp()).post("/api/sheets/accounts").send({ row: account });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("200 faz bulk upsert quando action é bulk", async () => {
    global.fetch = mockFetchOk({ ok: true, data: MOCK_ACCOUNTS });
    const res    = await request(makeApp())
      .post("/api/sheets/accounts")
      .send({ action: "bulk", rows: MOCK_ACCOUNTS });

    expect(res.status).toBe(200);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe("bulk_upsert");
  });

  test("400 para entidade inválida", async () => {
    const res = await request(makeApp()).post("/api/sheets/hack").send({ row: {} });
    expect(res.status).toBe(400);
  });

  test("500 quando Apps Script falha no upsert", async () => {
    global.fetch = mockFetchOk(MOCK_SHEETS_ERROR("Erro ao guardar"));
    const res    = await request(makeApp())
      .post("/api/sheets/accounts")
      .send({ row: MOCK_ACCOUNTS[0] });

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/sheets/:entity/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 elimina registo por id", async () => {
    global.fetch = mockFetchOk({ ok: true });
    const res    = await request(makeApp()).delete("/api/sheets/accounts/1");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("envia action delete com o id correcto", async () => {
    global.fetch = mockFetchOk({ ok: true });
    await request(makeApp()).delete("/api/sheets/accounts/42");

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe("delete");
    expect(String(body.id)).toBe("42");
  });

  test("400 para entidade inválida", async () => {
    const res = await request(makeApp()).delete("/api/sheets/hack/1");
    expect(res.status).toBe(400);
  });

  test("500 quando Apps Script falha", async () => {
    global.fetch = mockFetchOk(MOCK_SHEETS_ERROR("Registo não encontrado"));
    const res    = await request(makeApp()).delete("/api/sheets/accounts/999");
    expect(res.status).toBe(500);
  });
});
