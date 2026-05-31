import {
  NodeTracerProvider,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-node";

import { Resource }                    from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME,
         SEMRESATTRS_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { trace, SpanStatusCode }       from "@opentelemetry/api";

// ── Provider ──────────────────────────────────────────────────

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]:    "kappy-engine",
    [SEMRESATTRS_SERVICE_VERSION]: "0.1.0",
  }),
});

// Exporta spans como JSON para stdout (OTLP-compatible)
// Em produção, trocar por OTLPTraceExporter apontando para um collector
provider.addSpanProcessor(
  new SimpleSpanProcessor(new ConsoleSpanExporter())
);

provider.register();

// ── Tracer ────────────────────────────────────────────────────

export const tracer = trace.getTracer("kappy-engine", "0.1.0");
export { SpanStatusCode };

// ── Helper: wrap async function in a span ────────────────────
// Uso:
//   const result = await withSpan("stocks.search", { "query": q }, async (span) => {
//     return await repo.search(q);
//   });

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