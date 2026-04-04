import { getRuntimeConfig } from "./env.js";

const abuseState = new Map();
const REPEATED_MESSAGE_WINDOW = 5;

function now() {
  return Date.now();
}

function cleanupExpiredEntries(timestamp) {
  for (const [key, value] of abuseState.entries()) {
    if (value.resetAt <= timestamp) {
      abuseState.delete(key);
    }
  }
}

function getClientIp(request) {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return "unknown";
}

function buildClientKey(request, metadata = {}) {
  const origin = request.headers.get("origin") || "no-origin";
  const ip = getClientIp(request);
  const source = metadata.source || "unknown-source";
  return `${ip}::${origin}::${source}`;
}

function hashMessage(value) {
  return String(value || "").trim().toLowerCase();
}

function hasBurstDuplicate(history, nextHash, maxDuplicates) {
  const recentHistory = history.slice(-REPEATED_MESSAGE_WINDOW);
  const duplicateCount = recentHistory.filter((entry) => entry === nextHash).length;
  return duplicateCount >= maxDuplicates;
}

export function checkAbuseProtection({ request, metadata = {}, messages, env }) {
  const runtimeConfig = getRuntimeConfig(env);
  const timestamp = now();
  cleanupExpiredEntries(timestamp);

  const clientKey = buildClientKey(request, metadata);
  const clientWindow = abuseState.get(clientKey) || {
    count: 0,
    resetAt: timestamp + runtimeConfig.rateLimitWindowMs,
    recentMessageHashes: [],
  };

  if (clientWindow.resetAt <= timestamp) {
    clientWindow.count = 0;
    clientWindow.resetAt = timestamp + runtimeConfig.rateLimitWindowMs;
    clientWindow.recentMessageHashes = [];
  }

  if (clientWindow.count >= runtimeConfig.rateLimitMaxRequests) {
    return {
      ok: false,
      error: {
        code: "rate_limited",
        message: "Too many chat requests in a short period. Please wait a moment and try again.",
      },
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((clientWindow.resetAt - timestamp) / 1000),
      ),
    };
  }

  const lastUserMessage = messages.at(-1)?.content || "";
  const lastMessageHash = hashMessage(lastUserMessage);

  if (
    lastMessageHash &&
    hasBurstDuplicate(
      clientWindow.recentMessageHashes,
      lastMessageHash,
      runtimeConfig.duplicateMessageThreshold,
    )
  ) {
    return {
      ok: false,
      error: {
        code: "duplicate_message_burst",
        message: "That message has been sent too many times in a row. Please rephrase or wait a moment.",
      },
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((clientWindow.resetAt - timestamp) / 1000),
      ),
    };
  }

  clientWindow.count += 1;
  if (lastMessageHash) {
    clientWindow.recentMessageHashes.push(lastMessageHash);
    if (clientWindow.recentMessageHashes.length > REPEATED_MESSAGE_WINDOW) {
      clientWindow.recentMessageHashes = clientWindow.recentMessageHashes.slice(
        -REPEATED_MESSAGE_WINDOW,
      );
    }
  }

  abuseState.set(clientKey, clientWindow);

  return {
    ok: true,
    remainingRequests: Math.max(
      0,
      runtimeConfig.rateLimitMaxRequests - clientWindow.count,
    ),
    resetAt: clientWindow.resetAt,
  };
}
