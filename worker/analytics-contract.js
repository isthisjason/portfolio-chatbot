export const EVENTS_API_PATH = "/api/events";
export const MAX_EVENT_BODY_LENGTH = 6000;
export const MAX_EVENT_NAME_LENGTH = 64;
export const MAX_EVENT_VALUE_LENGTH = 200;
export const ALLOWED_WIDGET_EVENTS = new Set([
  "open",
  "send",
  "fallback",
  "refusal",
  "error",
]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value, maxLength = MAX_EVENT_VALUE_LENGTH) {
  return String(value || "").slice(0, maxLength);
}

function hasOnlyAllowedKeys(object, allowedKeys) {
  return Object.keys(object).every((key) => allowedKeys.includes(key));
}

export function parseAnalyticsEvent(body) {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      error: {
        code: "invalid_body",
        message: "Analytics event body must be a JSON object.",
      },
    };
  }

  if (!hasOnlyAllowedKeys(body, ["event", "metadata"])) {
    return {
      ok: false,
      error: {
        code: "unknown_event_fields",
        message: "Analytics event body may only include 'event' and optional 'metadata'.",
      },
    };
  }

  const event = truncate(body.event, MAX_EVENT_NAME_LENGTH).toLowerCase();
  if (!ALLOWED_WIDGET_EVENTS.has(event)) {
    return {
      ok: false,
      error: {
        code: "invalid_event",
        message: "Unsupported analytics event.",
      },
    };
  }

  if (body.metadata !== undefined && !isPlainObject(body.metadata)) {
    return {
      ok: false,
      error: {
        code: "invalid_metadata",
        message: "Analytics metadata must be an object when provided.",
      },
    };
  }

  if (
    body.metadata &&
    !hasOnlyAllowedKeys(body.metadata, [
      "source",
      "pagePath",
      "sessionId",
      "widgetVersion",
      "messageLength",
      "fallbackReason",
      "refusalReason",
      "statusCode",
    ])
  ) {
    return {
      ok: false,
      error: {
        code: "unknown_metadata_fields",
        message: "Unsupported analytics metadata fields.",
      },
    };
  }

  const metadata = body.metadata || {};

  return {
    ok: true,
    data: {
      event,
      metadata: {
        source: truncate(metadata.source),
        pagePath: truncate(metadata.pagePath),
        sessionId: truncate(metadata.sessionId),
        widgetVersion: truncate(metadata.widgetVersion),
        fallbackReason: truncate(metadata.fallbackReason),
        refusalReason: truncate(metadata.refusalReason),
        messageLength: Number.isFinite(Number(metadata.messageLength))
          ? Number(metadata.messageLength)
          : undefined,
        statusCode: Number.isFinite(Number(metadata.statusCode))
          ? Number(metadata.statusCode)
          : undefined,
      },
    },
  };
}
