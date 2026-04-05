const BASE_URL = process.env.WORKER_BASE_URL || "http://127.0.0.1:8787";
const TEST_MODE = process.env.WORKER_TEST_MODE || "missing-secret";
const ORIGIN = process.env.WORKER_TEST_ORIGIN || "http://localhost:4173";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertWithResult(condition, message, result) {
  if (!condition) {
    throw new Error(
      `${message}\nstatus=${result.status}\nbody=${result.text}`,
    );
  }
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (ORIGIN && !headers.has("origin")) {
    headers.set("origin", ORIGIN);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: response.status,
    headers: response.headers,
    text,
    json,
  };
}

function printResult(name, result) {
  const detail =
    result.json?.error?.code ||
    result.json?.meta?.fallbackReason ||
    result.json?.meta?.provider ||
    "ok";

  console.log(`PASS ${name} (${result.status}, ${detail})`);
}

async function testMethodValidation() {
  const result = await request("/api/chat", {
    method: "GET",
  });

  assertWithResult(result.status === 405, "GET /api/chat should return 405", result);
  assertWithResult(
    result.json?.error?.code === "method_not_allowed",
    "Expected method_not_allowed",
    result,
  );
  printResult("method validation", result);
}

async function testContentTypeValidation() {
  const result = await request("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "text/plain",
    },
    body: "hello",
  });

  assertWithResult(result.status === 415, "Invalid content type should return 415", result);
  assertWithResult(
    result.json?.error?.code === "unsupported_content_type",
    "Expected unsupported_content_type",
    result,
  );
  printResult("content-type validation", result);
}

async function testInvalidJsonValidation() {
  const result = await request("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{bad json",
  });

  assertWithResult(result.status === 400, "Invalid JSON should return 400", result);
  assertWithResult(result.json?.error?.code === "invalid_json", "Expected invalid_json", result);
  printResult("invalid JSON validation", result);
}

async function testPayloadValidation() {
  const result = await request("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messages: [],
    }),
  });

  assertWithResult(result.status === 400, "Empty messages should return 400", result);
  assertWithResult(
    result.json?.error?.code === "invalid_messages",
    "Expected invalid_messages",
    result,
  );
  printResult("payload validation", result);
}

async function testAnalyticsEvent() {
  const result = await request("/api/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      event: "open",
      metadata: {
        source: "worker-test",
        pagePath: "/test",
        sessionId: "worker-test-session",
        widgetVersion: "1.0.0",
      },
    }),
  });

  assertWithResult(result.status === 202, "Analytics event should return 202", result);
  assertWithResult(result.json?.ok === true, "Expected analytics ack payload", result);
  printResult("analytics event", result);
}

async function testMissingSecretFallback() {
  const result = await request("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: "What kind of engineer is Jason?",
        },
      ],
      metadata: {
        source: "worker-test",
        pagePath: "/test",
        sessionId: "worker-test-session",
      },
    }),
  });

  assertWithResult(
    result.status === 200,
    "Missing secret path should return 200 fallback response",
    result,
  );
  assertWithResult(result.json?.meta?.fallback === true, "Expected fallback response", result);
  assertWithResult(
    result.json?.meta?.fallbackReason === "missing_provider_secret",
    "Expected missing_provider_secret fallback",
    result,
  );
  printResult("missing secret fallback", result);
}

async function testProviderFailureFallback() {
  const result = await request("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: "Which project best reflects full-stack experience?",
        },
      ],
      metadata: {
        source: "worker-test",
      },
    }),
  });

  assertWithResult(
    result.status === 200,
    "Provider failure path should return 200 fallback response",
    result,
  );
  assertWithResult(result.json?.meta?.fallback === true, "Expected fallback response", result);
  assertWithResult(
    result.json?.meta?.fallbackReason === "provider_failure",
    "Expected provider_failure fallback",
    result,
  );
  printResult("provider failure fallback", result);
}

async function testLiveSuccess() {
  const result = await request("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: "Which project best reflects full-stack experience?",
        },
      ],
      metadata: {
        source: "worker-test",
        pagePath: "/test",
        sessionId: "worker-test-session",
      },
    }),
  });

  assertWithResult(result.status === 200, "Live provider request should return 200", result);
  assertWithResult(result.json?.reply, "Expected a reply string", result);
  assertWithResult(result.json?.meta?.fallback === false, "Expected non-fallback success", result);
  assertWithResult(result.json?.meta?.grounded === true, "Expected grounded success", result);
  printResult("live success", result);
}

async function run() {
  console.log(`Testing Worker at ${BASE_URL} in mode '${TEST_MODE}'`);

  await testMethodValidation();
  await testContentTypeValidation();
  await testInvalidJsonValidation();
  await testPayloadValidation();
  await testAnalyticsEvent();

  if (TEST_MODE === "missing-secret") {
    await testMissingSecretFallback();
  } else if (TEST_MODE === "provider-failure") {
    await testProviderFailureFallback();
  } else if (TEST_MODE === "success") {
    await testLiveSuccess();
  } else {
    throw new Error(
      `Unknown WORKER_TEST_MODE '${TEST_MODE}'. Use missing-secret, provider-failure, or success.`,
    );
  }

  console.log("Worker smoke tests passed.");
}

run().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
