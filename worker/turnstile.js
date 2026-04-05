import { getProviderSecrets, getRuntimeConfig } from "./env.js";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken({ request, token, env }) {
  const runtimeConfig = getRuntimeConfig(env);
  if (!runtimeConfig.turnstileRequired) {
    return { ok: true, skipped: true };
  }

  const secrets = getProviderSecrets(env);
  if (!secrets.turnstileSecretKey) {
    return {
      ok: false,
      code: "turnstile_not_configured",
      message:
        "Turnstile is required but TURNSTILE_SECRET_KEY is not configured.",
    };
  }

  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return {
      ok: false,
      code: "turnstile_required",
      message: "Captcha verification is required before sending chat requests.",
    };
  }

  const ip =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";

  const formData = new URLSearchParams();
  formData.set("secret", secrets.turnstileSecretKey);
  formData.set("response", normalizedToken);
  if (ip) {
    formData.set("remoteip", ip);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    return {
      ok: false,
      code: "turnstile_unavailable",
      message: "Captcha verification could not be completed right now.",
    };
  }

  const payload = await response.json();
  if (!payload.success) {
    return {
      ok: false,
      code: "turnstile_failed",
      message: "Captcha verification failed. Please try again.",
      details: Array.isArray(payload["error-codes"])
        ? payload["error-codes"].slice(0, 5)
        : undefined,
    };
  }

  return { ok: true, skipped: false };
}
