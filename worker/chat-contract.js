export const CHAT_API_PATH = "/api/chat";
export const CHAT_CONTRACT_VERSION = "2026-04-04";
export const MAX_CHAT_MESSAGES = 10;
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_METADATA_LENGTH = 200;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value, maxLength = MAX_METADATA_LENGTH) {
  return String(value).slice(0, maxLength);
}

export function buildChatSuccess({ reply, model, grounded = true, requestId }) {
  return {
    reply,
    meta: {
      requestId,
      model,
      grounded,
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

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return {
      ok: false,
      error: {
        code: "invalid_messages",
        message: "Request body must include a non-empty messages array.",
      },
    };
  }

  const normalizedMessages = [];

  for (const message of body.messages.slice(-MAX_CHAT_MESSAGES)) {
    if (!isPlainObject(message)) {
      return {
        ok: false,
        error: {
          code: "invalid_message",
          message: "Each message must be an object with role and content.",
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

    const content = truncate(message.content || "", MAX_MESSAGE_LENGTH).trim();
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

  const metadata = isPlainObject(body.metadata)
    ? {
        source: body.metadata.source ? truncate(body.metadata.source) : undefined,
        pagePath: body.metadata.pagePath ? truncate(body.metadata.pagePath) : undefined,
        sessionId: body.metadata.sessionId ? truncate(body.metadata.sessionId) : undefined,
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
