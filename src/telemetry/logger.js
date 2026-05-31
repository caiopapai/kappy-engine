// src/telemetry/logger.js
// Logger estruturado manual seguindo a especificação OpenTelemetry Logs.
// Emite NDJSON para stdout.

const SEVERITY = {
  INFO:  { number: 9,  text: "INFO"  },
  WARN:  { number: 13, text: "WARN"  },
  ERROR: { number: 17, text: "ERROR" },
};

const RESOURCE = {
  "service.name":       "kappy-engine",
  "service.version":    "0.1.0",
  "telemetry.sdk.name": "kappy-otel-manual",
};

function emit(severityKey, body, attributes = {}) {
  // eslint-disable-next-line security/detect-object-injection
  const severity = SEVERITY[severityKey];
  const nowNs    = BigInt(Date.now()) * 1_000_000n;

  const record = {
    Timestamp:         nowNs.toString(),
    ObservedTimestamp: nowNs.toString(),
    SeverityNumber:    severity.number,
    SeverityText:      severity.text,
    Body:              body,
    Resource:          RESOURCE,
    Attributes:        attributes,
  };

  process.stdout.write(JSON.stringify(record) + "\n");
}

export const logger = {
  info:  (body, attributes = {}) => emit("INFO",  body, attributes),
  warn:  (body, attributes = {}) => emit("WARN",  body, attributes),
  error: (body, attributes = {}) => emit("ERROR", body, attributes),
};
