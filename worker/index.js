import { buildSystemPrompt } from "./context.js";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

function normalizeMessages(messages = []) {
  return messages
    .filter((message) => message?.content && ["user", "assistant"].includes(message.role))
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: String(message.content).slice(0, 4000),
    }));
}

async function callOpenAI(messages, env) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: buildSystemPrompt(),
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
  const reply =
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content || [])
      ?.filter((item) => item.type === "output_text")
      ?.map((item) => item.text)
      ?.join("\n")
      ?.trim();

  return (
    reply ||
    "I don't have enough documented context to answer that confidently yet."
  );
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (pathname !== "/api/chat") {
      return json({ error: "Not found" }, { status: 404 });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    if (!env.OPENAI_API_KEY) {
      return json(
        {
          error: "Missing OPENAI_API_KEY secret in the Worker environment.",
        },
        { status: 500 },
      );
    }

    try {
      const payload = await request.json();
      const messages = normalizeMessages(payload?.messages);

      if (!messages.length) {
        return json(
          { error: "At least one user message is required." },
          { status: 400 },
        );
      }

      const reply = await callOpenAI(messages, env);
      return json({
        reply,
        meta: {
          model: env.OPENAI_MODEL || "gpt-4.1-mini",
          grounded: true,
        },
      });
    } catch (error) {
      console.error(error);
      return json(
        {
          error: "Unable to complete the chat request.",
          detail: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  },
};
