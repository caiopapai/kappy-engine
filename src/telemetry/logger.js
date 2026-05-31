const SEVERITY = {
  INFO:  { number: 9,  text: "INFO"  },
  WARN:  { number: 13, text: "WARN"  },
  ERROR: { number: 17, text: "ERROR" },
};

// ── Resource fixo para todo o processo ───────────────────────

const RESOURCE = {
  "service.name":       "kappy-engine",
  "service.version":    "0.1.0",
  "telemetry.sdk.name": "kappy-otel-manual",
};

// ── Emit ──────────────────────────────────────────────────────

function emit(severityKey, body, attributes = {}) {
  const severity = SEVERITY[severityKey];
  const nowNs    = BigInt(Date.now()) * 1_000_000n; // ms → nanoseconds

  const record = {
    Timestamp:         nowNs.toString(),
    ObservedTimestamp: nowNs.toString(),
    SeverityNumber:    severity.number,
    SeverityText:      severity.text,
    Body:              body,
    Resource:          RESOURCE,
    Attributes:        attributes,
  };

  // Escreve para stdout como JSON numa única linha (NDJSON)
  process.stdout.write(JSON.stringify(record) + "\n");
}

// ── API pública ───────────────────────────────────────────────

export const logger = {
  info:  (body, attributes = {}) => emit("INFO",  body, attributes),
  warn:  (body, attributes = {}) => emit("WARN",  body, attributes),
  error: (body, attributes = {}) => emit("ERROR", body, attributes),
};