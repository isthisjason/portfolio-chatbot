import { getRuntimeConfig, getProviderSecrets } from "../env.js";

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
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      text: {
        verbosity: "low",
      },
      max_output_tokens: runtimeConfig.maxOutputTokens,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${detail}`);
  }

  const payload = await response.json();
  const reply = extractOpenAIReply(payload);

  return {
    provider: "openai",
    model,
    reply,
  };
}
