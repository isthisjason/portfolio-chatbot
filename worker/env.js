const DEFAULTS = {
  aiProvider: "openai",
  openAIModel: "gpt-4.1-mini",
  anthropicModel: "claude-3-5-sonnet-latest",
  maxOutputTokens: 350,
  appEnvironment: "development",
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 12,
  duplicateMessageThreshold: 3,
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
    duplicateMessageThreshold: readInteger(
      env.DUPLICATE_MESSAGE_THRESHOLD,
      DEFAULTS.duplicateMessageThreshold,
    ),
  };
}

export function getProviderSecrets(env = {}) {
  return {
    openaiApiKey: readString(env.OPENAI_API_KEY),
    anthropicApiKey: readString(env.ANTHROPIC_API_KEY),
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
    duplicateMessageThreshold: config.duplicateMessageThreshold,
  };
}
