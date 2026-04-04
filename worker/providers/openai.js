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
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY secret in the Worker environment.");
  }

  const model = env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
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
      max_output_tokens: 350,
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
