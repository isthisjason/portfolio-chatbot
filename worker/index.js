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
  EVENTS_API_PATH,
  MAX_EVENT_BODY_LENGTH,
  parseAnalyticsEvent,
} from "./analytics-contract.js";
import {
  generateChatReply,
  validateProviderConfig,
} from "./providers/index.js";
import { resolveCors } from "./cors.js";
import { checkAbuseProtection } from "./abuse.js";
import { logError, logInfo, logWarn } from "./logger.js";
import { ProviderError } from "./providers/provider-error.js";
import {
  buildSensitiveRefusalReply,
  enforceResponseGuardrails,
  isSensitivePersonalQuestion,
} from "./guardrails.js";
import { verifyTurnstileToken } from "./turnstile.js";

function json(data, init = {}, corsHeaders = {}) {
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
}, corsHeaders) {
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
    {},
    corsHeaders,
  );
}

function analyticsAcceptedResponse({ requestId }, corsHeaders) {
  return json(
    {
      ok: true,
      meta: {
        requestId,
      },
    },
    {
      status: 202,
    },
    corsHeaders,
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
    const startedAt = Date.now();
    const cors = resolveCors(request, env);

    if (request.method === "OPTIONS") {
      if (!cors.allowed) {
        logWarn("cors.preflight_blocked", { requestId, origin: cors.origin }, env);
        return json(
          buildChatError({
            code: "origin_not_allowed",
            message: "Origin is not allowed to access this API.",
            requestId,
          }),
          { status: 403 },
          cors.headers,
        );
      }

      logInfo("cors.preflight_allowed", { requestId, origin: cors.origin }, env);
      return new Response(null, {
        status: 204,
        headers: cors.headers,
      });
    }

    if (pathname === "/" || pathname === "/health") {
      return json(
        {
          ok: true,
          service: "portfolio-chatbot-worker",
          routes: {
            chat: CHAT_API_PATH,
            analytics: EVENTS_API_PATH,
            health: "/health",
          },
        },
        {},
        cors.headers,
      );
    }

    if (pathname === "/favicon.ico") {
      return new Response(null, {
        status: 204,
        headers: cors.headers,
      });
    }

    if (pathname !== CHAT_API_PATH && pathname !== EVENTS_API_PATH) {
      return json(
        buildChatError({
          code: "not_found",
          message: "Route not found.",
          requestId,
        }),
        { status: 404 },
        cors.headers,
      );
    }

    if (!cors.allowed) {
      logWarn("cors.origin_blocked", { requestId, origin: cors.origin }, env);
      return json(
        buildChatError({
          code: "origin_not_allowed",
          message: "Origin is not allowed to access this API.",
          requestId,
        }),
        { status: 403 },
        cors.headers,
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
        cors.headers,
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
        cors.headers,
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
        cors.headers,
      );
    }

    if (pathname === EVENTS_API_PATH) {
      if (contentLength !== null && contentLength > MAX_EVENT_BODY_LENGTH) {
        return json(
          buildChatError({
            code: "event_request_too_large",
            message: `Analytics request body must be ${MAX_EVENT_BODY_LENGTH} bytes or fewer.`,
            requestId,
          }),
          { status: 413 },
          cors.headers,
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
            cors.headers,
          );
        }

        if (rawBody.length > MAX_EVENT_BODY_LENGTH) {
          return json(
            buildChatError({
              code: "event_request_too_large",
              message: `Analytics request body must be ${MAX_EVENT_BODY_LENGTH} bytes or fewer.`,
              requestId,
            }),
            { status: 413 },
            cors.headers,
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
            cors.headers,
          );
        }

        const parsedEvent = parseAnalyticsEvent(payload);
        if (!parsedEvent.ok) {
          return json(
            buildChatError({
              ...parsedEvent.error,
              requestId,
            }),
            { status: 400 },
            cors.headers,
          );
        }

        const { event, metadata } = parsedEvent.data;
        const logDetails = {
          requestId,
          event,
          source: metadata.source,
          pagePath: metadata.pagePath,
          sessionId: metadata.sessionId,
          widgetVersion: metadata.widgetVersion,
          messageLength: metadata.messageLength,
          fallbackReason: metadata.fallbackReason,
          refusalReason: metadata.refusalReason,
          statusCode: metadata.statusCode,
          origin: cors.origin,
        };

        if (event === "error" || event === "fallback") {
          logWarn("analytics.widget_event", logDetails, env);
        } else {
          logInfo("analytics.widget_event", logDetails, env);
        }

        return analyticsAcceptedResponse({ requestId }, cors.headers);
      } catch (error) {
        logError(
          "analytics.unexpected_failure",
          {
            requestId,
            errorName: error instanceof Error ? error.name : "UnknownError",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          env,
        );
        return analyticsAcceptedResponse({ requestId }, cors.headers);
      }
    }

    const providerConfig = validateProviderConfig(env);
    if (!providerConfig.ok) {
      logError(
        "provider.config_missing_secret",
        {
          requestId,
          provider: providerConfig.provider,
          missingSecrets: providerConfig.missingSecrets,
        },
        env,
      );
      return buildFallbackResponse({
        requestId,
        provider: providerConfig.provider,
        reason: "missing_provider_secret",
      }, cors.headers);
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
          cors.headers,
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
          cors.headers,
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
          cors.headers,
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
          cors.headers,
        );
      }

      const { messages, turnstileToken } = parsedRequest.data;
      const latestUserMessage = messages.at(-1)?.content || "";

      const turnstileResult = await verifyTurnstileToken({
        request,
        token: turnstileToken,
        env,
      });
      if (!turnstileResult.ok) {
        logWarn(
          "abuse.turnstile_blocked",
          {
            requestId,
            code: turnstileResult.code,
            origin: cors.origin,
          },
          env,
        );
        return json(
          buildChatError({
            code: turnstileResult.code,
            message: turnstileResult.message,
            details: turnstileResult.details,
            requestId,
          }),
          { status: 403 },
          cors.headers,
        );
      }

      const abuseCheck = checkAbuseProtection({
        request,
        metadata: parsedRequest.data.metadata,
        messages,
        env,
      });

      if (!abuseCheck.ok) {
        logWarn(
          "abuse.request_blocked",
          {
            requestId,
            code: abuseCheck.error.code,
            retryAfterSeconds: abuseCheck.retryAfterSeconds,
            origin: cors.origin,
          },
          env,
        );
        return json(
          buildChatError({
            ...abuseCheck.error,
            requestId,
          }),
          {
            status: 429,
            headers: {
              "retry-after": String(abuseCheck.retryAfterSeconds),
            },
          },
          cors.headers,
        );
      }

      if (isSensitivePersonalQuestion(latestUserMessage)) {
        logWarn(
          "guardrail.sensitive_question_refused",
          { requestId },
          env,
        );
        return json(
          buildChatSuccess({
            reply: buildSensitiveRefusalReply(),
            model: "guardrail",
            grounded: true,
            requestId,
            refusal: true,
            refusalReason: "sensitive_personal_question",
          }),
          {},
          cors.headers,
        );
      }

      const result = await generateChatReply({
        messages,
        systemPrompt: buildSystemPrompt(),
        env,
      });

      const guardedResponse = enforceResponseGuardrails({
        userMessage: latestUserMessage,
        reply: result.reply,
      });

      if (guardedResponse.kind === "refusal") {
        logWarn(
          "guardrail.response_refused",
          {
            requestId,
            provider: result.provider,
            model: result.model,
            reason: guardedResponse.guardrailReason,
          },
          env,
        );
        return json(
          buildChatSuccess({
            reply: guardedResponse.reply,
            model: result.model,
            provider: result.provider,
            grounded: true,
            requestId,
            refusal: true,
            refusalReason: guardedResponse.guardrailReason,
          }),
          {},
          cors.headers,
        );
      }

      if (isUnderGroundedReply(result.reply) || guardedResponse.kind === "fallback") {
        logWarn(
          "chat.guardrail_fallback",
          {
            requestId,
            provider: result.provider,
            model: result.model,
            reason:
              guardedResponse.guardrailReason ||
              "under_grounded_reply",
          },
          env,
        );
        return buildFallbackResponse({
          requestId,
          model: result.model,
          provider: result.provider,
          reason:
            guardedResponse.guardrailReason ||
            "under_grounded_reply",
        }, cors.headers);
      }

      logInfo(
        "chat.response_sent",
        {
          requestId,
          provider: result.provider,
          model: result.model,
          durationMs: Date.now() - startedAt,
          fallback: false,
          refusal: false,
          source: parsedRequest.data.metadata?.source,
        },
        env,
      );

      return json(
        buildChatSuccess({
          reply: guardedResponse.reply,
          model: result.model,
          provider: result.provider,
          grounded: true,
          requestId,
        }),
        {},
        cors.headers,
      );
    } catch (error) {
      if (error instanceof ProviderError) {
        logError(
          "provider.request_failed",
          {
            requestId,
            provider: error.provider,
            statusCode: error.statusCode,
            category: error.category,
            retryable: error.retryable,
            providerDetail: error.providerDetail,
          },
          env,
        );
      } else {
        logError(
          "chat.unexpected_failure",
          {
            requestId,
            errorName: error instanceof Error ? error.name : "UnknownError",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          env,
        );
      }
      return buildFallbackResponse({
        requestId,
        reason: "provider_failure",
      }, cors.headers);
    }
  },
};
