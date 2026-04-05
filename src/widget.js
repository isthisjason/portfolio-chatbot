const STYLE_TEXT = __WIDGET_CSS__;
const EMBED_CONTRACT_VERSION = "1.0.0";
const WIDGET_GLOBAL_NAME = "PortfolioChatbotWidget";
const CONFIG_GLOBAL_NAME = "PortfolioChatbotConfig";
const WIDGET_HOST_ID = "portfolio-chatbot-widget";

const DEFAULT_CONFIG = {
  title: "Ask Jason",
  subtitle: "A grounded portfolio assistant for recruiters and hiring teams.",
  apiBaseUrl: "",
  starterQuestions: [
    "What projects best show security and production readiness?",
    "What kind of engineer is Jason?",
    "Which project best reflects full-stack experience?",
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

function normalizeConfig(config = {}) {
  return {
    title: normalizeString(config.title, DEFAULT_CONFIG.title),
    subtitle: normalizeString(config.subtitle, DEFAULT_CONFIG.subtitle),
    apiBaseUrl: normalizeString(config.apiBaseUrl).replace(/\/$/, ""),
    starterQuestions: normalizeStarterQuestions(config.starterQuestions),
  };
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "0px";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
}

function renderMessages() {
  const { messages } = state.elements;

  messages.innerHTML = state.conversation
    .map(
      (message) => `
        <div class="pcw-message ${message.role} ${message.kind || "default"}">
          <div>${escapeHtml(message.content)}</div>
          ${
            message.note
              ? `<div class="pcw-message-note">${escapeHtml(message.note)}</div>`
              : ""
          }
        </div>
      `,
    )
    .join("");

  messages.scrollTop = messages.scrollHeight;
}

function setStatus(message = "") {
  state.elements.status.textContent = message;
}

function setPending(nextPending) {
  state.pending = nextPending;
  state.elements.send.disabled = nextPending;
  state.elements.input.disabled = nextPending;
  state.elements.send.textContent = nextPending ? "Sending..." : "Send";
}

function setOpen(nextOpen) {
  state.open = nextOpen;
  state.elements.panel.classList.toggle("is-open", nextOpen);
  state.elements.launcher.setAttribute("aria-expanded", String(nextOpen));

  if (nextOpen) {
    state.elements.input.focus();
  }
}

async function submitMessage(content) {
  const message = content.trim();

  if (!message) {
    return;
  }

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
        messages: state.conversation,
        metadata: {
          source: "portfolio-widget",
          pagePath: window.location.pathname,
          sessionId: getSessionId(),
        },
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload?.error?.message || `Request failed with status ${response.status}`,
      );
    }
    const reply = payload?.reply?.trim();
    const isFallback = payload?.meta?.fallback === true;
    const fallbackReason = payload?.meta?.fallbackReason;

    state.conversation.push({
      role: "assistant",
      kind: isFallback ? "fallback" : "default",
      note: isFallback
        ? `Fallback response${fallbackReason ? `: ${fallbackReason.replaceAll("_", " ")}` : ""}`
        : "",
      content:
        reply ||
        "I couldn't find a grounded answer in the portfolio context yet.",
    });
    renderMessages();
    setStatus(isFallback ? "Showing safe fallback response" : "Connected to local Worker");
  } catch (error) {
    console.error("[portfolio-chatbot] request failed", error);
    state.conversation.push({
      role: "assistant",
      kind: "error",
      note: "Network or API error",
      content:
        "I'm having trouble reaching the portfolio assistant right now. Please try again in a moment.",
    });
    renderMessages();
    setStatus("Connection issue");
  } finally {
    setPending(false);
  }
}

function attachEventHandlers() {
  const {
    launcher,
    close,
    form,
    input,
    starters,
  } = state.elements;

  launcher.addEventListener("click", () => setOpen(!state.open));
  close.addEventListener("click", () => setOpen(false));

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

  starters.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-starter]");

    if (!button) {
      return;
    }

    const value = button.getAttribute("data-starter") || "";
    if (!state.open) {
      setOpen(true);
    }
    await submitMessage(value);
  });
}

function createMarkup(config) {
  const starterButtons = config.starterQuestions
    .map(
      (question) => `
        <button class="pcw-starter" type="button" data-starter="${escapeHtml(question)}">
          ${escapeHtml(question)}
        </button>
      `,
    )
    .join("");

  return `
    <style>${STYLE_TEXT}</style>
    <div class="pcw-root">
      <div class="pcw-panel" aria-live="polite">
        <header class="pcw-header">
          <div class="pcw-header-row">
            <div>
              <p class="pcw-eyebrow">Portfolio Assistant</p>
              <h2 class="pcw-title">${escapeHtml(config.title)}</h2>
              <p class="pcw-subtitle">${escapeHtml(config.subtitle)}</p>
            </div>
            <button class="pcw-close" type="button" aria-label="Close chat">
              ×
            </button>
          </div>
        </header>

        <div class="pcw-body">
          <div class="pcw-messages">
            <div class="pcw-message assistant">
              Ask about experience, projects, strengths, or stack. I'll stay grounded in the portfolio context and say when something isn't documented.
            </div>
          </div>

          <div class="pcw-starters">${starterButtons}</div>

          <form class="pcw-form">
            <textarea
              class="pcw-input"
              rows="1"
              placeholder="Ask a question about Jason's work..."
            ></textarea>
            <button class="pcw-send" type="submit">Send</button>
          </form>

          <div class="pcw-status" role="status"></div>
          <div class="pcw-footnote">
            Recruiter-facing answers are concise by design and avoid unsupported claims.
          </div>
        </div>
      </div>

      <button
        class="pcw-launcher"
        type="button"
        aria-label="Open portfolio chat"
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
    form: shadowRoot.querySelector(".pcw-form"),
    input: shadowRoot.querySelector(".pcw-input"),
    send: shadowRoot.querySelector(".pcw-send"),
    messages: shadowRoot.querySelector(".pcw-messages"),
    starters: shadowRoot.querySelector(".pcw-starters"),
    status: shadowRoot.querySelector(".pcw-status"),
  };

  attachEventHandlers();
  autoResizeTextarea(state.elements.input);
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
