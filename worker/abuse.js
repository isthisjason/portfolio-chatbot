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

function normalizeSource(value) {
  return String(value || "").trim().toLowerCase();
}

function hasTrustedSource(metadata, runtimeConfig) {
  const source = normalizeSource(metadata.source);
  if (!source) {
    return false;
  }

  return runtimeConfig.allowedSources.includes(source);
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

  if (!hasTrustedSource(metadata, runtimeConfig)) {
    return {
      ok: false,
      error: {
        code: "untrusted_source",
        message: "Request source is not trusted for this API.",
      },
      retryAfterSeconds: 60,
    };
  }

  const clientKey = buildClientKey(request, metadata);
  const clientWindow = abuseState.get(clientKey) || {
    count: 0,
    resetAt: timestamp + runtimeConfig.rateLimitWindowMs,
    lastRequestAt: 0,
    recentMessageHashes: [],
  };

  if (clientWindow.resetAt <= timestamp) {
    clientWindow.count = 0;
    clientWindow.resetAt = timestamp + runtimeConfig.rateLimitWindowMs;
    clientWindow.lastRequestAt = 0;
    clientWindow.recentMessageHashes = [];
  }

  const maxRequests = hasTrustedSource(metadata, runtimeConfig)
    ? runtimeConfig.rateLimitMaxRequests
    : runtimeConfig.untrustedRateLimitMaxRequests;

  if (clientWindow.count >= maxRequests) {
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

  if (
    clientWindow.lastRequestAt &&
    timestamp - clientWindow.lastRequestAt < runtimeConfig.rateLimitMinIntervalMs
  ) {
    return {
      ok: false,
      error: {
        code: "requests_too_frequent",
        message: "Requests are arriving too quickly. Please wait a moment and try again.",
      },
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(runtimeConfig.rateLimitMinIntervalMs / 1000),
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
  clientWindow.lastRequestAt = timestamp;
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
      maxRequests - clientWindow.count,
    ),
    resetAt: clientWindow.resetAt,
  };
}
