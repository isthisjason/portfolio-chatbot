const STYLE_TEXT = __WIDGET_CSS__;
const EMBED_CONTRACT_VERSION = "1.0.0";
const WIDGET_GLOBAL_NAME = "PortfolioChatbotWidget";
const CONFIG_GLOBAL_NAME = "PortfolioChatbotConfig";
const WIDGET_HOST_ID = "portfolio-chatbot-widget";

const DEFAULT_CONFIG = {
  title: "Ask Jason",
  subtitle: "Recruiter-focused answers grounded in public portfolio and resume details.",
  apiBaseUrl: "",
  analyticsEnabled: true,
  source: "portfolio-widget",
  turnstileToken: "",
  starterQuestions: [
    "What kind of engineer is Jason?",
    "Which project best demonstrates full-stack ownership?",
    "What shows his security and production readiness?",
  ],
};

const EMBED_SCRIPT_CONFIG = (() => {
  const script = document.currentScript;
  return script?.dataset ? { ...script.dataset } : {};
})();

const state = {
  mounted: false,
  open: false,
  pending: false,
  hasConnectionIssue: false,
  reconnectNotified: false,
  lastUserMessage: "",
  previousFocusedElement: null,
  startersVisible: true,
  animateNextAssistant: false,
  activeTyping: null,
  elements: {},
  config: { ...DEFAULT_CONFIG },
  conversation: [],
};

function getSessionId() {
  const key = "portfolio-chatbot-session-id";
  const existingValue = window.sessionStorage.getItem(key);

  if (existingValue) {
    return existingValue;
  }

  const nextValue =
    window.crypto?.randomUUID?.() || `pcw-${Date.now()}-${Math.random()}`;
  window.sessionStorage.setItem(key, nextValue);
  return nextValue;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeStarterQuestions(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  if (typeof value === "string") {
    return value
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  return DEFAULT_CONFIG.starterQuestions;
}

function normalizeString(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function normalizeConfig(config = {}) {
  return {
    title: normalizeString(config.title, DEFAULT_CONFIG.title),
    subtitle: normalizeString(config.subtitle, DEFAULT_CONFIG.subtitle),
    apiBaseUrl: normalizeString(config.apiBaseUrl).replace(/\/$/, ""),
    analyticsEnabled: normalizeBoolean(
      config.analyticsEnabled,
      DEFAULT_CONFIG.analyticsEnabled,
    ),
    source: normalizeString(config.source, DEFAULT_CONFIG.source),
    turnstileToken: normalizeString(config.turnstileToken),
    starterQuestions: normalizeStarterQuestions(config.starterQuestions),
  };
}

function parseJsonResponse(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildRequestMessages(conversation) {
  return conversation
    .map((message) => ({
      role: message?.role,
      content: message?.content,
    }))
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    );
}

function trackEvent(event, metadata = {}) {
  if (!state.config.apiBaseUrl || !state.config.analyticsEnabled) {
    return;
  }

  const payload = {
    event,
    metadata: {
      source: state.config.source,
      pagePath: window.location.pathname,
      sessionId: getSessionId(),
      widgetVersion: EMBED_CONTRACT_VERSION,
      ...metadata,
    },
  };

  fetch(`${state.config.apiBaseUrl}/api/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "0px";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}

function typeIntoElement(el, text) {
  if (state.activeTyping) {
    state.activeTyping.cancelled = true;
  }
  const ctrl = { cancelled: false };
  state.activeTyping = ctrl;

  // 20ms per tick; for long responses batch chars to stay under ~4s total
  const MS_PER_TICK = 20;
  const MAX_DURATION_MS = 4000;
  const charsPerTick = Math.max(1, Math.ceil(text.length / (MAX_DURATION_MS / MS_PER_TICK)));
  let i = 0;
  el.textContent = "";

  function step() {
    if (ctrl.cancelled || !el.isConnected) return;
    i = Math.min(i + charsPerTick, text.length);
    el.textContent = text.slice(0, i);
    state.elements.messages.scrollTop = state.elements.messages.scrollHeight;
    if (i < text.length) {
      setTimeout(step, MS_PER_TICK);
    } else {
      state.activeTyping = null;
    }
  }
  setTimeout(step, MS_PER_TICK);
}

function renderMessages() {
  const { messages } = state.elements;

  const shouldAnimate =
    state.animateNextAssistant &&
    state.conversation.length > 0 &&
    state.conversation[state.conversation.length - 1].role === "assistant";

  const visibleConversation = shouldAnimate
    ? state.conversation.slice(0, -1)
    : state.conversation;

  const conversationHtml = visibleConversation
    .map(
      (message) => `
        <div class="pcw-message ${message.role} ${message.kind || "default"}">
          <div class="pcw-message-text">${escapeHtml(message.content)}</div>
          ${
            message.note
              ? `<div class="pcw-message-note">${escapeHtml(message.note)}</div>`
              : ""
          }
        </div>
      `,
    )
    .join("");

  const animatedMsgHtml = shouldAnimate
    ? (() => {
        const msg = state.conversation[state.conversation.length - 1];
        return `<div class="pcw-message ${msg.role} ${msg.kind || "default"} pcw-typing-target">
          <div class="pcw-message-text"></div>
          ${msg.note ? `<div class="pcw-message-note">${escapeHtml(msg.note)}</div>` : ""}
        </div>`;
      })()
    : "";

  const pendingHtml = state.pending
    ? `
      <div class="pcw-message assistant typing" aria-live="polite" aria-label="Assistant is thinking">
        <span class="pcw-dots" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </div>
    `
    : "";

  const startersHtml =
    state.startersVisible && state.conversation.length <= 1 && !state.pending
      ? `<div class="pcw-starters-inline">${state.config.starterQuestions
          .map(
            (q) =>
              `<button class="pcw-starter" type="button" data-starter="${escapeHtml(q)}">${escapeHtml(q)}</button>`,
          )
          .join("")}</div>`
      : "";

  messages.innerHTML = `${conversationHtml}${animatedMsgHtml}${pendingHtml}${startersHtml}`;
  messages.scrollTop = messages.scrollHeight;

  if (shouldAnimate) {
    state.animateNextAssistant = false;
    const target = messages.querySelector(".pcw-typing-target div");
    if (target) {
      const msg = state.conversation[state.conversation.length - 1];
      typeIntoElement(target, msg.content);
    }
  }
}

function setStatus(message = "") {
  state.elements.status.textContent = message;
}

function setPending(nextPending) {
  state.pending = nextPending;
  state.elements.send.disabled = nextPending;
  state.elements.input.disabled = nextPending;
  state.elements.clear.disabled = nextPending;
  state.elements.retry.disabled = nextPending || !state.lastUserMessage;
  state.elements.send.textContent = nextPending ? "Sending..." : "Send";
  renderMessages();
}

function setOpen(nextOpen) {
  const wasOpen = state.open;
  state.open = nextOpen;
  state.elements.panel.classList.toggle("is-open", nextOpen);
  state.elements.launcher.setAttribute("aria-expanded", String(nextOpen));
  state.elements.retry.disabled = state.pending || !state.lastUserMessage;

  if (nextOpen) {
    if (!wasOpen) {
      trackEvent("open");
    }
    state.previousFocusedElement = document.activeElement;
    state.elements.input.focus();
  } else {
    const focusTarget =
      state.previousFocusedElement &&
      state.previousFocusedElement instanceof HTMLElement
        ? state.previousFocusedElement
        : state.elements.launcher;
    focusTarget.focus();
  }
}

function trapFocus(event) {
  if (!state.open || event.key !== "Tab") {
    return;
  }

  const focusable = Array.from(
    state.elements.panel.querySelectorAll(
      'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  );

  if (!focusable.length) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function onDocumentKeydown(event) {
  if (event.key === "Escape" && state.open) {
    event.preventDefault();
    setOpen(false);
    return;
  }

  trapFocus(event);
}

function clearConversation() {
  state.conversation = [
    {
      role: "assistant",
      kind: "default",
      content:
        "Ask about experience, projects, stack, or strengths. Replies stay concise and grounded in documented portfolio context.",
    },
  ];
  state.lastUserMessage = "";
  state.startersVisible = true;
  setStatus("Conversation cleared");
  setPending(false);
  renderMessages();
}

async function retryLastMessage() {
  if (!state.lastUserMessage || state.pending) {
    return;
  }

  await submitMessage(state.lastUserMessage);
}

async function submitMessage(content) {
  const message = content.trim();

  if (!message) {
    return;
  }

  state.lastUserMessage = message;
  trackEvent("send", { messageLength: message.length });

  if (!state.config.apiBaseUrl) {
    state.conversation.push({
      role: "assistant",
      kind: "error",
      note: "Widget configuration issue",
      content:
        "The chat widget is not configured with an API endpoint yet. Set apiBaseUrl in the embed config.",
    });
    renderMessages();
    setStatus("Missing apiBaseUrl");
    return;
  }

  state.conversation.push({ role: "user", content: message });
  renderMessages();
  setStatus("Thinking...");
  setPending(true);

  state.elements.input.value = "";
  autoResizeTextarea(state.elements.input);

  try {
    const response = await fetch(`${state.config.apiBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: buildRequestMessages(state.conversation),
        turnstileToken: state.config.turnstileToken || undefined,
        metadata: {
          source: state.config.source,
          pagePath: window.location.pathname,
          sessionId: getSessionId(),
        },
      }),
    });

    const rawPayload = await response.text();
    const payload = parseJsonResponse(rawPayload);

    if (!response.ok) {
      trackEvent("error", {
        statusCode: response.status,
      });
      const errorCode = payload?.error?.code;
      const errorMessage =
        payload?.error?.message || `Request failed with status ${response.status}`;
      throw new Error(
        `${errorCode ? `[${errorCode}] ` : ""}${errorMessage}`,
      );
    }
    const reply = payload?.reply?.trim();
    const isFallback = payload?.meta?.fallback === true;
    const fallbackReason = payload?.meta?.fallbackReason;
    const refusal = payload?.meta?.refusal === true;
    const refusalReason = payload?.meta?.refusalReason;

    if (isFallback) {
      trackEvent("fallback", { fallbackReason });
    }
    if (refusal) {
      trackEvent("refusal", { refusalReason });
    }

    state.conversation.push({
      role: "assistant",
      kind: isFallback ? "fallback" : "default",
      note: isFallback
        ? `Safe fallback${fallbackReason ? `: ${fallbackReason.replaceAll("_", " ")}` : ""}`
        : "",
      content:
        reply ||
        "I couldn't find a grounded answer in the portfolio context yet.",
    });
    state.animateNextAssistant = true;
    if (state.hasConnectionIssue) {
      state.hasConnectionIssue = false;
      state.reconnectNotified = true;
      setStatus("Reconnected. Responses are live again.");
    } else {
      setStatus(
        isFallback
          ? "Showing safe fallback response"
          : "Connected and responding",
      );
    }
  } catch (error) {
    console.error("[portfolio-chatbot] request failed", error);
    state.hasConnectionIssue = true;
    state.reconnectNotified = false;
    const detail = String(error?.message || "").trim().slice(0, 180);
    state.conversation.push({
      role: "assistant",
      kind: "error",
      note: "Network or API error",
      content: detail
        ? `I couldn't complete that request. ${detail}`
        : "I couldn't reach the portfolio assistant just now. You can retry the last question or wait a moment and try again.",
    });
    state.animateNextAssistant = true;
    setStatus("Connection issue. Retry is available.");
    trackEvent("error", {
      statusCode: 0,
    });
  } finally {
    setPending(false);
  }
}

function attachEventHandlers() {
  const {
    launcher,
    close,
    clear,
    retry,
    form,
    input,
    messages,
  } = state.elements;

  launcher.addEventListener("click", () => setOpen(!state.open));
  close.addEventListener("click", () => setOpen(false));
  clear.addEventListener("click", clearConversation);
  retry.addEventListener("click", retryLastMessage);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitMessage(input.value);
  });

  input.addEventListener("input", () => autoResizeTextarea(input));
  input.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await submitMessage(input.value);
    }
  });

  messages.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-starter]");

    if (!button) {
      return;
    }

    const value = button.getAttribute("data-starter") || "";

    const startersEl = messages.querySelector(".pcw-starters-inline");
    if (startersEl) {
      startersEl.classList.add("is-hiding");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    state.startersVisible = false;

    if (!state.open) {
      setOpen(true);
    }
    await submitMessage(value);
  });

  document.addEventListener("keydown", onDocumentKeydown);
}

function createMarkup(config) {
  return `
    <style>${STYLE_TEXT}</style>
    <div class="pcw-root">
      <div
        id="pcw-panel"
        class="pcw-panel"
        aria-live="polite"
        role="dialog"
        aria-modal="false"
        aria-label="${escapeHtml(config.title)} chat panel"
      >
        <header class="pcw-header">
          <div class="pcw-header-row">
            <div>
              <p class="pcw-eyebrow">Portfolio Assistant</p>
              <h2 class="pcw-title">${escapeHtml(config.title)}</h2>
              <p class="pcw-subtitle">${escapeHtml(config.subtitle)}</p>
            </div>
            <div class="pcw-header-actions">
              <button class="pcw-clear" type="button" aria-label="Clear chat">
                Clear
              </button>
              <button class="pcw-close" type="button" aria-label="Close chat">
                ×
              </button>
            </div>
          </div>
        </header>

        <div class="pcw-body">
          <div class="pcw-messages">
            <div class="pcw-message assistant">
              Ask about experience, projects, stack, or strengths. Replies stay concise and grounded in documented portfolio context.
            </div>
          </div>

          <form class="pcw-form">
            <label class="pcw-visually-hidden" for="pcw-input">
              Ask a question
            </label>
            <textarea
              id="pcw-input"
              class="pcw-input"
              rows="1"
              placeholder="Ask a recruiter-style question..."
              aria-label="Ask a question about Jason's experience"
            ></textarea>
            <button class="pcw-send" type="submit">Send</button>
          </form>

          <div class="pcw-controls">
            <button class="pcw-retry" type="button" aria-label="Retry last question">
              Retry Last
            </button>
          </div>

          <div class="pcw-status" role="status" aria-live="polite"></div>
          <div class="pcw-footnote">
            Recruiter-facing responses stay concise, grounded, and explicit when context is incomplete.
          </div>
        </div>
      </div>

      <button
        class="pcw-launcher"
        type="button"
        aria-label="Open portfolio chat"
        aria-haspopup="dialog"
        aria-controls="pcw-panel"
        aria-expanded="false"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4.5 4v-4.5A2.5 2.5 0 0 1 4 13V6.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M8 8.75h8M8 11.75h5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;
}

function resolveConfig(overrides = {}) {
  const globalConfig = window[CONFIG_GLOBAL_NAME] || {};
  const scriptConfig = EMBED_SCRIPT_CONFIG;
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...globalConfig,
    ...overrides,
    apiBaseUrl:
      overrides.apiBaseUrl ||
      globalConfig.apiBaseUrl ||
      scriptConfig.apiBaseUrl ||
      "",
    title:
      overrides.title ||
      globalConfig.title ||
      scriptConfig.title ||
      DEFAULT_CONFIG.title,
    subtitle:
      overrides.subtitle ||
      globalConfig.subtitle ||
      scriptConfig.subtitle ||
      DEFAULT_CONFIG.subtitle,
    starterQuestions:
      overrides.starterQuestions ||
      globalConfig.starterQuestions ||
      scriptConfig.starterQuestions ||
      DEFAULT_CONFIG.starterQuestions,
    analyticsEnabled:
      overrides.analyticsEnabled ??
      globalConfig.analyticsEnabled ??
      DEFAULT_CONFIG.analyticsEnabled,
    source:
      overrides.source ||
      globalConfig.source ||
      scriptConfig.source ||
      DEFAULT_CONFIG.source,
    turnstileToken:
      overrides.turnstileToken ||
      globalConfig.turnstileToken ||
      scriptConfig.turnstileToken ||
      DEFAULT_CONFIG.turnstileToken,
  };

  return normalizeConfig(mergedConfig);
}

function mountWidget(overrides = {}) {
  if (state.mounted) {
    return state;
  }

  const config = resolveConfig(overrides);
  const host = document.createElement("div");
  host.id = WIDGET_HOST_ID;

  const shadowRoot = host.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = createMarkup(config);
  document.body.append(host);

  state.mounted = true;
  state.config = config;
  state.elements = {
    host,
    panel: shadowRoot.querySelector(".pcw-panel"),
    launcher: shadowRoot.querySelector(".pcw-launcher"),
    close: shadowRoot.querySelector(".pcw-close"),
    clear: shadowRoot.querySelector(".pcw-clear"),
    retry: shadowRoot.querySelector(".pcw-retry"),
    form: shadowRoot.querySelector(".pcw-form"),
    input: shadowRoot.querySelector(".pcw-input"),
    send: shadowRoot.querySelector(".pcw-send"),
    messages: shadowRoot.querySelector(".pcw-messages"),
    status: shadowRoot.querySelector(".pcw-status"),
  };

  attachEventHandlers();
  autoResizeTextarea(state.elements.input);
  setPending(false);
  setStatus(
    state.config.apiBaseUrl
      ? `Ready for ${state.config.apiBaseUrl}/api/chat`
      : "Set apiBaseUrl to connect the widget",
  );
  return state;
}

function unmountWidget() {
  if (!state.mounted) {
    return;
  }

  document.removeEventListener("keydown", onDocumentKeydown);
  state.elements.host?.remove();
  state.mounted = false;
  state.open = false;
  state.pending = false;
  state.elements = {};
  state.conversation = [];
}

function updateConfig(overrides = {}) {
  state.config = resolveConfig(overrides);
  if (state.mounted) {
    unmountWidget();
    mountWidget(state.config);
  }
  return state.config;
}

window[WIDGET_GLOBAL_NAME] = {
  contractVersion: EMBED_CONTRACT_VERSION,
  mount: mountWidget,
  unmount: unmountWidget,
  updateConfig,
  getConfig: () => ({ ...state.config }),
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => mountWidget(), {
    once: true,
  });
} else {
  mountWidget();
}
