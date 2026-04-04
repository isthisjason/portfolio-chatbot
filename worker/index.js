import { buildSystemPrompt } from "./context.js";
import {
  CHAT_API_PATH,
  MAX_REQUEST_BODY_LENGTH,
  buildChatError,
  buildChatSuccess,
  parseChatRequest,
} from "./chat-contract.js";

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

function readContentLength(request) {
  const raw = request.headers.get("content-length");
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
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
    const requestId = crypto.randomUUID();

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (pathname !== CHAT_API_PATH) {
      return json(
        buildChatError({
          code: "not_found",
          message: "Route not found.",
          requestId,
        }),
        { status: 404 },
      );
    }

    if (request.method !== "POST") {
      return json(
        buildChatError({
          code: "method_not_allowed",
          message: "Use POST for this endpoint.",
          requestId,
        }),
        { status: 405 },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json(
        buildChatError({
          code: "unsupported_content_type",
          message: "Content-Type must be application/json.",
          requestId,
        }),
        { status: 415 },
      );
    }

    const contentLength = readContentLength(request);
    if (contentLength !== null && contentLength > MAX_REQUEST_BODY_LENGTH) {
      return json(
        buildChatError({
          code: "request_too_large",
          message: `Request body must be ${MAX_REQUEST_BODY_LENGTH} bytes or fewer.`,
          requestId,
        }),
        { status: 413 },
      );
    }

    if (!env.OPENAI_API_KEY) {
      return json(
        buildChatError({
          code: "missing_provider_secret",
          message: "Missing OPENAI_API_KEY secret in the Worker environment.",
          requestId,
        }),
        { status: 500 },
      );
    }

    try {
      const rawBody = await request.text();

      if (!rawBody.trim()) {
        return json(
          buildChatError({
            code: "empty_body",
            message: "Request body must not be empty.",
            requestId,
          }),
          { status: 400 },
        );
      }

      if (rawBody.length > MAX_REQUEST_BODY_LENGTH) {
        return json(
          buildChatError({
            code: "request_too_large",
            message: `Request body must be ${MAX_REQUEST_BODY_LENGTH} bytes or fewer.`,
            requestId,
          }),
          { status: 413 },
        );
      }

      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return json(
          buildChatError({
            code: "invalid_json",
            message: "Request body must be valid JSON.",
            requestId,
          }),
          { status: 400 },
        );
      }

      const parsedRequest = parseChatRequest(payload);

      if (!parsedRequest.ok) {
        return json(
          buildChatError({
            ...parsedRequest.error,
            requestId,
          }),
          { status: 400 },
        );
      }

      const { messages } = parsedRequest.data;
      const reply = await callOpenAI(messages, env);
      return json(
        buildChatSuccess({
          reply,
          model: env.OPENAI_MODEL || "gpt-4.1-mini",
          grounded: true,
          requestId,
        }),
      );
    } catch (error) {
      console.error(error);
      return json(
        buildChatError({
          code: "chat_request_failed",
          message: "Unable to complete the chat request.",
          details: error instanceof Error ? error.message : "Unknown error",
          requestId,
        }),
        { status: 500 },
      );
    }
  },
};
