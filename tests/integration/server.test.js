// tests/integration/server.test.js
// Testa o servidor Express completo — health, CORS, 404 global.

import request from "supertest";
import express from "express";
import cors    from "cors";
import { errorHandler, notFound } from "../../src/middleware/errorHandler.js";

jest.mock("../../src/telemetry/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../src/telemetry/tracer.js", () => ({
  withSpan: async (_n, _a, fn) => fn({ setAttribute: jest.fn() }),
  SpanStatusCode: { OK: "OK", ERROR: "ERROR" },
}));
jest.mock("../../src/config/index.js", () => ({
  config: {
    port:   3001,
    sheets: { url: "https://script.google.com/test", apiKey: "test-key" },
    stocks: { provider: "brapi" },
    brapi:  { token: "", baseUrl: "https://brapi.dev/api" },
  },
}));

// Constrói o app sem arrancar o servidor (listen)
async function makeFullApp() {
  const { default: stocksRouter }       = await import("../../src/routes/stocks.js");
  const { default: sheetsRouter }       = await import("../../src/routes/sheets.js");
  const { default: transactionsRouter } = await import("../../src/routes/transactions.js");

  const app = express();
  app.use(cors({ origin: ["http://localhost:5173"] }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "kappy-engine", version: "0.1.0" });
  });

  app.use("/api/stocks",       stocksRouter);
  app.use("/api/sheets",       sheetsRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

describe("GET /health", () => {
  test("200 com ok:true e service:kappy-engine", async () => {
    const app = await makeFullApp();
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("kappy-engine");
    expect(res.body.version).toBeDefined();
  });
});

describe("404 global", () => {
  test("rota desconhecida devolve 404 com ok:false", async () => {
    const app = await makeFullApp();
    const res = await request(app).get("/api/nao-existe");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain("GET /api/nao-existe");
  });

  test("método errado numa rota existente devolve 404", async () => {
    const app = await makeFullApp();
    const res = await request(app).put("/health");

    expect(res.status).toBe(404);
  });
});

describe("CORS headers", () => {
  test("inclui Access-Control-Allow-Origin para origem permitida", async () => {
    const app = await makeFullApp();
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});
