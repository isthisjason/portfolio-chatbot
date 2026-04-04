export const CHAT_API_PATH = "/api/chat";
export const CHAT_CONTRACT_VERSION = "2026-04-04";
export const MAX_CHAT_MESSAGES = 10;
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_METADATA_LENGTH = 200;
export const MAX_REQUEST_BODY_LENGTH = 25000;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value, maxLength = MAX_METADATA_LENGTH) {
  return String(value).slice(0, maxLength);
}

function hasOnlyAllowedKeys(object, allowedKeys) {
  return Object.keys(object).every((key) => allowedKeys.includes(key));
}

export function buildChatSuccess({
  reply,
  model,
  grounded = true,
  requestId,
  provider,
  fallback = false,
  fallbackReason,
  refusal = false,
  refusalReason,
}) {
  return {
    reply,
    meta: {
      requestId,
      model,
      ...(provider ? { provider } : {}),
      grounded,
      fallback,
      ...(fallbackReason ? { fallbackReason } : {}),
      refusal,
      ...(refusalReason ? { refusalReason } : {}),
      contractVersion: CHAT_CONTRACT_VERSION,
    },
  };
}

export function buildChatError({ code, message, requestId, details }) {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta: {
      requestId,
      contractVersion: CHAT_CONTRACT_VERSION,
    },
  };
}

export function parseChatRequest(body) {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      error: {
        code: "invalid_body",
        message: "Request body must be a JSON object.",
      },
    };
  }

  if (!hasOnlyAllowedKeys(body, ["messages", "metadata"])) {
    return {
      ok: false,
      error: {
        code: "unknown_request_fields",
        message: "Only 'messages' and optional 'metadata' are allowed in the request body.",
      },
    };
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return {
      ok: false,
      error: {
        code: "invalid_messages",
        message: "Request body must include a non-empty messages array.",
      },
    };
  }

  if (body.messages.length > MAX_CHAT_MESSAGES) {
    return {
      ok: false,
      error: {
        code: "too_many_messages",
        message: `Request may include at most ${MAX_CHAT_MESSAGES} messages.`,
      },
    };
  }

  const normalizedMessages = [];

  for (const message of body.messages) {
    if (!isPlainObject(message)) {
      return {
        ok: false,
        error: {
          code: "invalid_message",
          message: "Each message must be an object with role and content.",
        },
      };
    }

    if (!hasOnlyAllowedKeys(message, ["role", "content"])) {
      return {
        ok: false,
        error: {
          code: "unknown_message_fields",
          message: "Each message may only include 'role' and 'content'.",
        },
      };
    }

    if (!["user", "assistant"].includes(message.role)) {
      return {
        ok: false,
        error: {
          code: "invalid_role",
          message: "Message role must be either 'user' or 'assistant'.",
        },
      };
    }

    if (typeof message.content !== "string") {
      return {
        ok: false,
        error: {
          code: "invalid_content_type",
          message: "Each message content value must be a string.",
        },
      };
    }

    if (message.content.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: {
          code: "message_too_long",
          message: `Each message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
        },
      };
    }
    const content = message.content.trim();
    if (!content) {
      return {
        ok: false,
        error: {
          code: "invalid_content",
          message: "Each message must include non-empty content.",
        },
      };
    }

    normalizedMessages.push({
      role: message.role,
      content,
    });
  }

  if (normalizedMessages.at(-1)?.role !== "user") {
    return {
      ok: false,
      error: {
        code: "last_message_must_be_user",
        message: "The final message in the request must come from the user.",
      },
    };
  }

  if (body.metadata !== undefined && !isPlainObject(body.metadata)) {
    return {
      ok: false,
      error: {
        code: "invalid_metadata",
        message: "Metadata must be an object when provided.",
      },
    };
  }

  if (body.metadata && !hasOnlyAllowedKeys(body.metadata, ["source", "pagePath", "sessionId"])) {
    return {
      ok: false,
      error: {
        code: "unknown_metadata_fields",
        message: "Metadata may only include 'source', 'pagePath', and 'sessionId'.",
      },
    };
  }

  const metadata = body.metadata
    ? {
        source:
          typeof body.metadata.source === "string"
            ? truncate(body.metadata.source)
            : undefined,
        pagePath:
          typeof body.metadata.pagePath === "string"
            ? truncate(body.metadata.pagePath)
            : undefined,
        sessionId:
          typeof body.metadata.sessionId === "string"
            ? truncate(body.metadata.sessionId)
            : undefined,
      }
    : {};

  return {
    ok: true,
    data: {
      messages: normalizedMessages,
      metadata,
    },
  };
}
