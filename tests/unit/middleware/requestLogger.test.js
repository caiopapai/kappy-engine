// tests/unit/middleware/requestLogger.test.js
import { requestLogger } from "../../../src/middleware/requestLogger.js";

// Mock do logger para não poluir stdout
jest.mock("../../../src/telemetry/logger.js", () => ({
  logger: {
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from "../../../src/telemetry/logger.js";

function makeResMock(statusCode = 200) {
  const listeners = {};
  return {
    statusCode,
    on:   (event, cb) => { listeners[event] = cb; },
    emit: (event) => {
      if (listeners[event]) {
        listeners[event]();
      }
    },
  };
}

describe("requestLogger middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("chama next()", () => {
    const req  = { method: "GET", path: "/health", query: {}, ip: "127.0.0.1" };
    const res  = makeResMock(200);
    const next = jest.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("emite logger.info para status 200", () => {
    const req = { method: "GET", path: "/api/sheets/accounts", query: {}, ip: "127.0.0.1" };
    const res = makeResMock(200);
    const next = jest.fn();

    requestLogger(req, res, next);
    res.emit("finish");

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("emite logger.warn para status 404", () => {
    const req  = { method: "GET", path: "/nao-existe", query: {}, ip: "127.0.0.1" };
    const res  = makeResMock(404);
    const next = jest.fn();

    requestLogger(req, res, next);
    res.emit("finish");

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  test("emite logger.error para status 500", () => {
    const req  = { method: "POST", path: "/api/transactions", query: {}, ip: "127.0.0.1" };
    const res  = makeResMock(500);
    const next = jest.fn();

    requestLogger(req, res, next);
    res.emit("finish");

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test("inclui http.method, http.route e http.status_code nos attributes", () => {
    const req  = { method: "DELETE", path: "/api/transactions/123", query: {}, ip: "::1" };
    const res  = makeResMock(200);
    const next = jest.fn();

    requestLogger(req, res, next);
    res.emit("finish");

    const attrs = logger.info.mock.calls[0][1];
    expect(attrs["http.method"]).toBe("DELETE");
    expect(attrs["http.route"]).toBe("/api/transactions/123");
    expect(attrs["http.status_code"]).toBe(200);
    expect(attrs["http.duration_ms"]).toBeGreaterThanOrEqual(0);
  });

  test("inclui http.query quando há query params", () => {
    const req  = { method: "GET", path: "/api/stocks/search", query: { q: "PETR", type: "stock" }, ip: "127.0.0.1" };
    const res  = makeResMock(200);
    const next = jest.fn();

    requestLogger(req, res, next);
    res.emit("finish");

    const attrs = logger.info.mock.calls[0][1];
    expect(attrs["http.query"]).toBeDefined();
    expect(attrs["http.query"]).toContain("PETR");
  });

  test("não inclui http.query quando não há query params", () => {
    const req  = { method: "GET", path: "/health", query: {}, ip: "127.0.0.1" };
    const res  = makeResMock(200);
    const next = jest.fn();

    requestLogger(req, res, next);
    res.emit("finish");

    const attrs = logger.info.mock.calls[0][1];
    expect(attrs["http.query"]).toBeUndefined();
  });
});
