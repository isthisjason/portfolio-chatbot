import {
  buildRecruiterFallbackReply,
  buildSystemPrompt,
  getFallbackMessage,
} from "./context.js";
import {
  CHAT_API_PATH,
  MAX_REQUEST_BODY_LENGTH,
  buildChatError,
  buildChatSuccess,
  parseChatRequest,
} from "./chat-contract.js";
import {
  generateChatReply,
  validateProviderConfig,
} from "./providers/index.js";

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

function buildFallbackResponse({
  requestId,
  model = "fallback",
  provider,
  reason,
}) {
  return json(
    buildChatSuccess({
      reply: buildRecruiterFallbackReply(),
      model,
      provider,
      grounded: false,
      requestId,
      fallback: true,
      fallbackReason: reason,
    }),
  );
}

function isUnderGroundedReply(reply) {
  if (!reply || typeof reply !== "string") {
    return true;
  }

  const normalizedReply = reply.trim();
  if (!normalizedReply) {
    return true;
  }

  const fallbackMessage = getFallbackMessage().toLowerCase();
  const lowerReply = normalizedReply.toLowerCase();

  if (lowerReply === fallbackMessage) {
    return true;
  }

  const lowConfidenceSignals = [
    "i don't know",
    "i dont know",
    "not enough context",
    "not enough information",
    "insufficient context",
    "can't answer that confidently",
    "cannot answer that confidently",
  ];

  return lowConfidenceSignals.some((signal) => lowerReply.includes(signal));
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

    const providerConfig = validateProviderConfig(env);
    if (!providerConfig.ok) {
      console.error(
        `Missing required secret(s) for provider '${providerConfig.provider}': ${providerConfig.missingSecrets.join(", ")}.`,
      );
      return buildFallbackResponse({
        requestId,
        provider: providerConfig.provider,
        reason: "missing_provider_secret",
      });
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
      const result = await generateChatReply({
        messages,
        systemPrompt: buildSystemPrompt(),
        env,
      });

      if (isUnderGroundedReply(result.reply)) {
        return buildFallbackResponse({
          requestId,
          model: result.model,
          provider: result.provider,
          reason: "under_grounded_reply",
        });
      }

      return json(
        buildChatSuccess({
          reply: result.reply,
          model: result.model,
          provider: result.provider,
          grounded: true,
          requestId,
        }),
      );
    } catch (error) {
      console.error(error);
      return buildFallbackResponse({
        requestId,
        reason: "provider_failure",
      });
    }
  },
};
