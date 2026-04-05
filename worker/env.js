const DEFAULTS = {
  aiProvider: "openai",
  openAIModel: "gpt-4.1-mini",
  anthropicModel: "claude-3-5-sonnet-latest",
  maxOutputTokens: 350,
  appEnvironment: "development",
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 12,
  rateLimitMinIntervalMs: 1200,
  untrustedRateLimitMaxRequests: 4,
  duplicateMessageThreshold: 3,
  allowedSources: "portfolio-widget,worker-test",
  turnstileRequired: false,
};

function readString(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseAllowedSources(value, fallback = DEFAULTS.allowedSources) {
  const raw = readString(value, fallback);
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function getRuntimeConfig(env = {}) {
  return {
    aiProvider: readString(env.AI_PROVIDER, DEFAULTS.aiProvider).toLowerCase(),
    openAIModel: readString(env.OPENAI_MODEL, DEFAULTS.openAIModel),
    anthropicModel: readString(env.ANTHROPIC_MODEL, DEFAULTS.anthropicModel),
    maxOutputTokens: readInteger(env.MAX_OUTPUT_TOKENS, DEFAULTS.maxOutputTokens),
    appEnvironment: readString(env.APP_ENV, DEFAULTS.appEnvironment),
    allowedOrigins: readString(env.ALLOWED_ORIGINS),
    rateLimitWindowMs: readInteger(
      env.RATE_LIMIT_WINDOW_MS,
      DEFAULTS.rateLimitWindowMs,
    ),
    rateLimitMaxRequests: readInteger(
      env.RATE_LIMIT_MAX_REQUESTS,
      DEFAULTS.rateLimitMaxRequests,
    ),
    rateLimitMinIntervalMs: readInteger(
      env.RATE_LIMIT_MIN_INTERVAL_MS,
      DEFAULTS.rateLimitMinIntervalMs,
    ),
    untrustedRateLimitMaxRequests: readInteger(
      env.UNTRUSTED_RATE_LIMIT_MAX_REQUESTS,
      DEFAULTS.untrustedRateLimitMaxRequests,
    ),
    duplicateMessageThreshold: readInteger(
      env.DUPLICATE_MESSAGE_THRESHOLD,
      DEFAULTS.duplicateMessageThreshold,
    ),
    allowedSources: parseAllowedSources(env.ALLOWED_SOURCES),
    turnstileRequired: readBoolean(
      env.TURNSTILE_REQUIRED,
      DEFAULTS.turnstileRequired,
    ),
  };
}

export function getProviderSecrets(env = {}) {
  return {
    openaiApiKey: readString(env.OPENAI_API_KEY),
    anthropicApiKey: readString(env.ANTHROPIC_API_KEY),
    turnstileSecretKey: readString(env.TURNSTILE_SECRET_KEY),
  };
}

export function getPublicRuntimeSummary(env = {}) {
  const config = getRuntimeConfig(env);

  return {
    aiProvider: config.aiProvider,
    openAIModel: config.openAIModel,
    anthropicModel: config.anthropicModel,
    maxOutputTokens: config.maxOutputTokens,
    appEnvironment: config.appEnvironment,
    allowedOrigins: config.allowedOrigins,
    rateLimitWindowMs: config.rateLimitWindowMs,
    rateLimitMaxRequests: config.rateLimitMaxRequests,
    rateLimitMinIntervalMs: config.rateLimitMinIntervalMs,
    untrustedRateLimitMaxRequests: config.untrustedRateLimitMaxRequests,
    duplicateMessageThreshold: config.duplicateMessageThreshold,
    allowedSources: config.allowedSources,
    turnstileRequired: config.turnstileRequired,
  };
}
