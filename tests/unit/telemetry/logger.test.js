// tests/unit/telemetry/logger.test.js
import { logger } from "../../../src/telemetry/logger.js";

describe("logger", () => {
  let writeSpy;

  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  function getLastLog() {
    const call = writeSpy.mock.calls[writeSpy.mock.calls.length - 1];
    return JSON.parse(call[0]);
  }

  test("logger.info emite SeverityNumber 9 e SeverityText INFO", () => {
    logger.info("teste info");
    const log = getLastLog();
    expect(log.SeverityNumber).toBe(9);
    expect(log.SeverityText).toBe("INFO");
    expect(log.Body).toBe("teste info");
  });

  test("logger.warn emite SeverityNumber 13 e SeverityText WARN", () => {
    logger.warn("teste warn");
    const log = getLastLog();
    expect(log.SeverityNumber).toBe(13);
    expect(log.SeverityText).toBe("WARN");
  });

  test("logger.error emite SeverityNumber 17 e SeverityText ERROR", () => {
    logger.error("teste error");
    const log = getLastLog();
    expect(log.SeverityNumber).toBe(17);
    expect(log.SeverityText).toBe("ERROR");
  });

  test("emite Resource com service.name kappy-engine", () => {
    logger.info("teste");
    const log = getLastLog();
    expect(log.Resource["service.name"]).toBe("kappy-engine");
  });

  test("emite Attributes passados como argumento", () => {
    logger.info("teste", { "query": "PETR", "count": 3 });
    const log = getLastLog();
    expect(log.Attributes.query).toBe("PETR");
    expect(log.Attributes.count).toBe(3);
  });

  test("Timestamp está em nanosegundos (string de 19 dígitos)", () => {
    logger.info("teste");
    const log = getLastLog();
    expect(typeof log.Timestamp).toBe("string");
    expect(log.Timestamp.length).toBeGreaterThanOrEqual(19);
  });

  test("emite JSON numa única linha terminada em \\n", () => {
    logger.info("teste");
    const raw = writeSpy.mock.calls[writeSpy.mock.calls.length - 1][0];
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.indexOf("\n")).toBe(raw.length - 1); // só um \n no fim
  });

  test("Attributes vazio por defeito", () => {
    logger.info("sem atributos");
    const log = getLastLog();
    expect(log.Attributes).toEqual({});
  });
});
