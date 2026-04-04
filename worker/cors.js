import { getRuntimeConfig } from "./env.js";

const DEFAULT_ALLOWED_HEADERS = "content-type, authorization";
const DEFAULT_ALLOWED_METHODS = "POST, OPTIONS";
const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function parseAllowedOrigins(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, env) {
  if (!origin) {
    return true;
  }

  const runtimeConfig = getRuntimeConfig(env);
  const configuredOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  if (runtimeConfig.appEnvironment !== "production" && LOCALHOST_PATTERN.test(origin)) {
    return true;
  }

  return false;
}

export function resolveCors(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = isAllowedOrigin(origin, env);
  const requestHeaders =
    request.headers.get("access-control-request-headers") || DEFAULT_ALLOWED_HEADERS;

  const headers = {
    "access-control-allow-methods": DEFAULT_ALLOWED_METHODS,
    "access-control-allow-headers": requestHeaders,
    "access-control-max-age": "86400",
    vary: "Origin",
  };

  if (origin && allowed) {
    headers["access-control-allow-origin"] = origin;
  }

  return {
    allowed,
    origin,
    headers,
  };
}
