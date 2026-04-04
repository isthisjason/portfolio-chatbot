import { getRuntimeConfig, getProviderSecrets } from "../env.js";

export async function generateAnthropicChatReply({ env }) {
  const runtimeConfig = getRuntimeConfig(env);
  const secrets = getProviderSecrets(env);

  if (!secrets.anthropicApiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY secret in the Worker environment.");
  }

  throw new Error(
    `Anthropic provider support is not implemented yet for model '${runtimeConfig.anthropicModel}'. Set AI_PROVIDER=openai to use the current backend.`,
  );
}
