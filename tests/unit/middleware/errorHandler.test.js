// tests/unit/middleware/errorHandler.test.js
import { errorHandler, notFound } from "../../../src/middleware/errorHandler.js";

jest.mock("../../../src/telemetry/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { logger } from "../../../src/telemetry/logger.js";

function makeReq(method = "GET", path = "/test") {
  return { method, path };
}

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json   = (body)  => { res._body  = body;  return res; };
  return res;
}

describe("errorHandler", () => {
  beforeEach(() => jest.clearAllMocks());

  test("devolve status 500 por defeito", () => {
    const req = makeReq("POST", "/api/sheets/accounts");
    const res = makeRes();
    const err = new Error("falha interna");

    errorHandler(err, req, res, jest.fn());

    expect(res._status).toBe(500);
    expect(res._body.ok).toBe(false);
    expect(res._body.error).toBe("falha interna");
  });

  test("usa err.status quando definido", () => {
    const req = makeReq();
    const res = makeRes();
    const err = Object.assign(new Error("não autorizado"), { status: 401 });

    errorHandler(err, req, res, jest.fn());

    expect(res._status).toBe(401);
  });

  test("emite logger.error", () => {
    const req = makeReq("DELETE", "/api/transactions/1");
    const res = makeRes();
    const err = new Error("erro");

    errorHandler(err, req, res, jest.fn());

    expect(logger.error).toHaveBeenCalledTimes(1);
    const attrs = logger.error.mock.calls[0][1];
    expect(attrs["http.method"]).toBe("DELETE");
    expect(attrs["http.route"]).toBe("/api/transactions/1");
    expect(attrs["error"]).toBe("erro");
  });
});

describe("notFound", () => {
  beforeEach(() => jest.clearAllMocks());

  test("devolve status 404", () => {
    const req = makeReq("GET", "/rota-inexistente");
    const res = makeRes();

    notFound(req, res);

    expect(res._status).toBe(404);
    expect(res._body.ok).toBe(false);
    expect(res._body.error).toContain("GET /rota-inexistente");
  });

  test("emite logger.warn", () => {
    const req = makeReq("PUT", "/api/nada");
    const res = makeRes();

    notFound(req, res);

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
