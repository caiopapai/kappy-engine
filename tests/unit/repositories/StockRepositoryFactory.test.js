// tests/unit/repositories/StockRepositoryFactory.test.js
import { BrapiRepository } from "../../../src/repositories/stocks/BrapiRepository.js";

jest.mock("../../../src/telemetry/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../src/telemetry/tracer.js", () => ({
  withSpan: async (_n, _a, fn) => fn({ setAttribute: jest.fn() }),
  SpanStatusCode: { OK: "OK", ERROR: "ERROR" },
}));

describe("StockRepositoryFactory", () => {
  beforeEach(() => {
    // Reset singleton cache entre testes
    jest.resetModules();
  });

  test("devolve BrapiRepository quando provider é brapi", async () => {
    jest.mock("../../../src/config/index.js", () => ({
      config: { stocks: { provider: "brapi" }, brapi: { token: "", baseUrl: "" } },
    }));
    const { getStockRepository: get } = await import("../../../src/repositories/stocks/StockRepositoryFactory.js");
    const repo = get();
    expect(repo).toBeInstanceOf(BrapiRepository);
  });

  test("devolve BrapiRepository como fallback para provider desconhecido", async () => {
    jest.mock("../../../src/config/index.js", () => ({
      config: { stocks: { provider: "unknown_provider" }, brapi: { token: "", baseUrl: "" } },
    }));
    const { getStockRepository: get } = await import("../../../src/repositories/stocks/StockRepositoryFactory.js");
    const repo = get();
    expect(repo).toBeInstanceOf(BrapiRepository);
  });

  test("devolve a mesma instância em chamadas consecutivas (singleton)", async () => {
    jest.mock("../../../src/config/index.js", () => ({
      config: { stocks: { provider: "brapi" }, brapi: { token: "", baseUrl: "" } },
    }));
    const { getStockRepository: get } = await import("../../../src/repositories/stocks/StockRepositoryFactory.js");
    const r1 = get();
    const r2 = get();
    expect(r1).toBe(r2);
  });
});
