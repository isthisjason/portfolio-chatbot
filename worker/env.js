const DEFAULTS = {
  aiProvider: "openai",
  openAIModel: "gpt-4.1-mini",
  anthropicModel: "claude-3-5-sonnet-latest",
  maxOutputTokens: 350,
  appEnvironment: "development",
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
  };
}
