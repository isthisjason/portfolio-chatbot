import { getRuntimeConfig, getProviderSecrets } from "../env.js";
import { ProviderError } from "./provider-error.js";

function extractOpenAIReply(payload) {
  return (
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content || [])
      ?.filter((item) => item.type === "output_text")
      ?.map((item) => item.text)
      ?.join("\n")
      ?.trim()
  );
}

function toInputMessage(message) {
  return {
    role: message.role,
    content: message.content,
  };
}

export async function generateOpenAIChatReply({ messages, systemPrompt, env }) {
  const runtimeConfig = getRuntimeConfig(env);
  const secrets = getProviderSecrets(env);

  if (!secrets.openaiApiKey) {
    throw new Error("Missing OPENAI_API_KEY secret in the Worker environment.");
  }

  const model = runtimeConfig.openAIModel;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secrets.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: systemPrompt,
      input: messages.map(toInputMessage),
      max_output_tokens: runtimeConfig.maxOutputTokens,
    }),
  });

  if (!response.ok) {
    const providerDetail = (await response.text()).slice(0, 600);
    throw new ProviderError("OpenAI request failed.", {
      provider: "openai",
      statusCode: response.status,
      category: response.status >= 500 ? "provider_upstream_error" : "provider_request_rejected",
      retryable: response.status >= 500 || response.status === 429,
      providerDetail,
    });
  }

  const payload = await response.json();
  const reply = extractOpenAIReply(payload);

  return {
    provider: "openai",
    model,
    reply,
  };
}
