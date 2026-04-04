import { generateAnthropicChatReply } from "./anthropic.js";
import { generateOpenAIChatReply } from "./openai.js";
import { getProviderSecrets, getRuntimeConfig } from "../env.js";

const PROVIDERS = {
  anthropic: {
    requiredSecrets: ["ANTHROPIC_API_KEY"],
    generateReply: generateAnthropicChatReply,
  },
  openai: {
    requiredSecrets: ["OPENAI_API_KEY"],
    generateReply: generateOpenAIChatReply,
  },
};

export function getActiveProvider(env) {
  const requestedProvider = getRuntimeConfig(env).aiProvider;
  return PROVIDERS[requestedProvider]
    ? requestedProvider
    : "openai";
}

export function validateProviderConfig(env) {
  const provider = getActiveProvider(env);
  const secrets = getProviderSecrets(env);
  const missingSecrets = PROVIDERS[provider].requiredSecrets.filter(
    (secretName) => {
      if (secretName === "OPENAI_API_KEY") {
        return !secrets.openaiApiKey;
      }

      if (secretName === "ANTHROPIC_API_KEY") {
        return !secrets.anthropicApiKey;
      }

      return true;
    },
  );

  if (missingSecrets.length) {
    return {
      ok: false,
      provider,
      missingSecrets,
    };
  }

  return {
    ok: true,
    provider,
    missingSecrets: [],
  };
}

export async function generateChatReply({ messages, systemPrompt, env }) {
  const provider = getActiveProvider(env);
  const result = await PROVIDERS[provider].generateReply({
    messages,
    systemPrompt,
    env,
  });

  return {
    ...result,
    provider,
  };
}
