// src/telemetry/tracer.js
// Tracer manual OpenTelemetry — sem auto-instrumentação.

import {
  NodeTracerProvider,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
} from "@opentelemetry/sdk-trace-node";

import { Resource }                    from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION }        from "@opentelemetry/semantic-conventions";
import { trace, SpanStatusCode }       from "@opentelemetry/api";

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]:    "kappy-engine",
    [SEMRESATTRS_SERVICE_VERSION]: "0.1.0",
  }),
});

provider.addSpanProcessor(
  new SimpleSpanProcessor(new ConsoleSpanExporter()),
);

provider.register();

export const tracer = trace.getTracer("kappy-engine", "0.1.0");
export { SpanStatusCode };

/**
 * Executa fn dentro de um span, gerindo status e erros automaticamente.
 */
export async function withSpan(name, attributes = {}, fn) {
  const span = tracer.startSpan(name, { attributes });
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
}
