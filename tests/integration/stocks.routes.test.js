// tests/integration/stocks.routes.test.js
import request from "supertest";
import express from "express";
import stocksRouter from "../../src/routes/stocks.js";
import { errorHandler, notFound } from "../../src/middleware/errorHandler.js";
import {
  MOCK_BRAPI_SEARCH,
  MOCK_BRAPI_SEARCH_WITH_INACTIVE,
  MOCK_BRAPI_QUOTE,
  MOCK_BRAPI_QUOTE_NULL_PRICE,
} from "../mocks/sheets.mock.js";
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
    brapi:  { token: "test-token", baseUrl: "https://brapi.dev/api" },
    stocks: { provider: "brapi" },
  },
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/stocks", stocksRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe("GET /api/stocks/search", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 com resultados para query válida", async () => {
    global.fetch = mockFetchOk(MOCK_BRAPI_SEARCH);
    const res = await request(makeApp()).get("/api/stocks/search?q=PETR");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.provider).toBe("brapi.dev");
  });

  test("400 sem parâmetro q", async () => {
    const res = await request(makeApp()).get("/api/stocks/search");
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test("400 com q vazio", async () => {
    const res = await request(makeApp()).get("/api/stocks/search?q=");
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test("200 com array vazio quando brapi não encontra resultados", async () => {
    global.fetch = mockFetchOk({ stocks: [] });
    const res = await request(makeApp()).get("/api/stocks/search?q=XYZXYZ");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  test("filtra ativos inativos (preço zero)", async () => {
    global.fetch = mockFetchOk(MOCK_BRAPI_SEARCH_WITH_INACTIVE);
    const res = await request(makeApp()).get("/api/stocks/search?q=PETR");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ticker).toBe("PETR4");
  });

  test("200 com [] quando fetch falha (resiliente)", async () => {
    global.fetch = mockFetchNetworkError();
    const res = await request(makeApp()).get("/api/stocks/search?q=PETR");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test("passa o type para a brapi", async () => {
    global.fetch = mockFetchOk(MOCK_BRAPI_SEARCH);
    await request(makeApp()).get("/api/stocks/search?q=FII&type=fund");

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("type=fund");
  });
});

describe("GET /api/stocks/quote/:tickers", () => {
  beforeEach(() => jest.clearAllMocks());

  test("200 com cotação para ticker válido", async () => {
    global.fetch = mockFetchOk(MOCK_BRAPI_QUOTE);
    const res = await request(makeApp()).get("/api/stocks/quote/PETR4");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.available).toBe(true);
    expect(res.body.data.ticker).toBe("PETR4");
    expect(res.body.data.price).toBe(38.50);
  });

  test("200 com array para múltiplos tickers", async () => {
    global.fetch = mockFetchOk({
      results: [
        { symbol: "PETR4", regularMarketPrice: 38.50, shortName: "PETROBRAS" },
        { symbol: "VALE3", regularMarketPrice: 61.20, shortName: "VALE" },
      ],
    });
    const res = await request(makeApp()).get("/api/stocks/quote/PETR4,VALE3");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  test("200 com available:false para ticker não encontrado (resiliente)", async () => {
    global.fetch = mockFetchOk({ results: [] });
    const res = await request(makeApp()).get("/api/stocks/quote/NAOEXISTE3");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.available).toBe(false);
    expect(res.body.message).toBeDefined();
  });

  test("200 com available:false para ticker com preço null", async () => {
    global.fetch = mockFetchOk(MOCK_BRAPI_QUOTE_NULL_PRICE);
    const res = await request(makeApp()).get("/api/stocks/quote/SUSP3");

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test("200 com available:false quando brapi devolve 404", async () => {
    global.fetch = mockFetchOk({ message: "not found" }, 404);
    const res = await request(makeApp()).get("/api/stocks/quote/XXXX3");

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test("200 com available:false quando fetch falha (resiliente)", async () => {
    global.fetch = mockFetchNetworkError();
    const res = await request(makeApp()).get("/api/stocks/quote/PETR4");

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.message).toBeDefined();
  });

  test("converte ticker para uppercase", async () => {
    global.fetch = mockFetchOk(MOCK_BRAPI_QUOTE);
    await request(makeApp()).get("/api/stocks/quote/petr4");

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("PETR4");
  });
});

describe("GET /api/stocks/provider", () => {
  test("200 devolve o nome do provider activo", async () => {
    const res = await request(makeApp()).get("/api/stocks/provider");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.provider).toBe("brapi.dev");
  });
});
