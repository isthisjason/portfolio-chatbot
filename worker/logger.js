import { getPublicRuntimeSummary } from "./env.js";

function sanitizeDetails(details = {}) {
  const sanitized = {};

  for (const [key, value] of Object.entries(details)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = value.slice(0, 300);
      continue;
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      Array.isArray(value)
    ) {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === "object") {
      sanitized[key] = "[object]";
    }
  }

  return sanitized;
}

export function logInfo(event, details = {}, env = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      event,
      runtime: getPublicRuntimeSummary(env),
      ...sanitizeDetails(details),
    }),
  );
}

export function logWarn(event, details = {}, env = {}) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event,
      runtime: getPublicRuntimeSummary(env),
      ...sanitizeDetails(details),
    }),
  );
}

export function logError(event, details = {}, env = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      runtime: getPublicRuntimeSummary(env),
      ...sanitizeDetails(details),
    }),
  );
}
