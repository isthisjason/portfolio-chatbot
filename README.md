# portfolio-chatbot

Embeddable recruiter-facing chatbot for a portfolio site. This project owns:

- the floating widget UI
- the `/api/chat` backend on a Cloudflare Worker
- the system prompt and structured portfolio context
- the deployment boundary separate from the main portfolio app

## Repo structure

```text
portfolio-chatbot/
├── public/
│   └── demo.html
├── data/
│   ├── README.md
│   └── portfolio/
│       ├── boundaries.js
│       ├── experience.js
│       ├── index.js
│       ├── owner.js
│       ├── projects.js
│       └── stack.js
├── scripts/
│   └── build-widget.mjs
├── src/
│   ├── widget.css
│   └── widget.js
├── worker/
│   ├── context.js
│   └── index.js
├── .gitignore
├── package.json
├── README.md
└── wrangler.toml
```

## Local workflow

```bash
npm install
npm run build
npm run dev:worker
```

In another terminal:

```bash
npm run preview:demo
```

Then open either:

- `http://127.0.0.1:4173/public/demo.html`
- `http://127.0.0.1:4173/dist/demo.html`

## Embed into the portfolio

Use a script tag once the widget assets are published from this repo:

```html
<script>
  window.PortfolioChatbotConfig = {
    apiBaseUrl: "https://your-chatbot-api.example.workers.dev",
    title: "Ask Jason",
    subtitle: "Ask about experience, projects, strengths, and stack.",
  };
</script>
<script
  src="https://your-chatbot-cdn.example.com/widget.js"
  data-api-base-url="https://your-chatbot-api.example.workers.dev"
  defer
></script>
```

The widget mounts itself into a Shadow DOM container, so its styles stay isolated from the TanStack/Vite portfolio.

## Worker secrets

Use Worker secrets for provider API keys. Do not commit secrets to the repo.

Production secret setup:

```bash
wrangler secret put OPENAI_API_KEY
```

Optional provider secret:

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Non-sensitive environment variables live in `wrangler.toml` or local `.env` files:

- `AI_PROVIDER` with `openai` as the current implemented default
- `OPENAI_MODEL`
- `ANTHROPIC_MODEL`
- `MAX_OUTPUT_TOKENS`
- `APP_ENV`
- `ALLOWED_ORIGINS`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `DUPLICATE_MESSAGE_THRESHOLD`

Provider notes:

- the Worker now calls providers through a shared abstraction in `worker/providers/`
- `openai` is implemented today
- `anthropic` is scaffolded behind the same interface but not implemented yet

Local development setup:

1. Copy `.dev.vars.example` to `.dev.vars` and add your real provider secret.
2. Copy `.env.example` to `.env` if you want local non-sensitive overrides.
3. Run `npm run dev:worker`.

Config rules:

- secrets belong in Worker secrets or local `.dev.vars`
- model names and environment flags belong in `wrangler.toml` vars or local `.env`
- CORS allowlists belong in `ALLOWED_ORIGINS` as a comma-separated list of exact origins
- nothing sensitive should be added to committed source files

## CORS

The widget and Worker are separate origins, so CORS is part of the feature, not an afterthought.

Current behavior:

- in development, localhost origins such as `http://localhost:4173` and `http://127.0.0.1:4173` are allowed automatically
- configured origins in `ALLOWED_ORIGINS` are always allowed
- in production, any browser origin not in `ALLOWED_ORIGINS` is rejected with `403`
- non-browser requests without an `Origin` header are still allowed

Recommended setup:

- local `.env`: `ALLOWED_ORIGINS=http://localhost:4173,http://127.0.0.1:4173`
- production `wrangler.toml`: replace `https://your-portfolio-domain.example` with your real portfolio origin

## Abuse Protection

The Worker includes a lightweight abuse layer before provider calls.

Current protections:

- request body size limits
- message count and message length validation
- origin allowlist checks
- per-client in-memory rate limiting using IP, origin, and request source
- duplicate-burst detection for repeated user messages

Current defaults:

- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX_REQUESTS=12`
- `DUPLICATE_MESSAGE_THRESHOLD=3`

Notes:

- this rate limiting is isolate-local, so it is intentionally lightweight rather than durable
- it is good enough as a first pass for recruiter-facing widget traffic
- if traffic grows, the next step is durable rate limiting with Cloudflare KV, Durable Objects, or another shared store

## Logging

The Worker uses structured logs for debugging without dumping user message content.

Current logging behavior:

- logs request IDs with CORS blocks, abuse blocks, provider config issues, and provider failures
- logs provider name, model, status code, and failure category when available
- avoids logging raw chat messages, request bodies, or API keys
- keeps fallback behavior user-safe even when internal errors are logged

## Worker Testing

Test the Worker independently before relying on the widget.

Start local Worker dev:

```bash
npm run dev:worker
```

In another terminal, run the smoke tests:

```bash
npm run test:worker
```

The smoke test script in `scripts/test-worker.mjs` always checks:

- method validation
- content-type validation
- invalid JSON handling
- payload validation

Then it runs one scenario-specific check based on `WORKER_TEST_MODE`:

- `missing-secret`:
  expects a safe fallback response when the provider secret is not configured
- `provider-failure`:
  expects a safe fallback response when the configured provider throws
- `success`:
  expects a grounded non-fallback success response from a live configured provider

Examples:

```bash
# default: missing secret fallback
npm run test:worker

# success mode with a real provider secret configured in local Worker dev
WORKER_TEST_MODE=success npm run test:worker

# provider failure mode, useful if local Worker dev is configured to use an unimplemented provider path
WORKER_TEST_MODE=provider-failure npm run test:worker
```

Optional overrides:

- `WORKER_BASE_URL` defaults to `http://127.0.0.1:8787`
- `WORKER_TEST_ORIGIN` defaults to `http://localhost:4173`

## Local Widget Integration

Once the Worker API is stable, test the real widget flow against local `wrangler dev`.

Run these in separate terminals:

```bash
npm run dev:worker
npm run build
npm run preview:demo
```

Then open:

- `http://127.0.0.1:4173/public/demo.html`
- or `http://127.0.0.1:4173/dist/demo.html`

The demo points to `http://127.0.0.1:8787` by default and stores overrides in local storage.

You can also override the API target with a query param:

```text
http://127.0.0.1:4173/public/demo.html?apiBaseUrl=http://127.0.0.1:8787
```

What to verify in the widget:

- real chat flow returns concise grounded answers
- fallback replies are visually labeled when the Worker returns a safe fallback
- network or API failures show a calm error state
- the widget status line shows whether it is connected to the local Worker

## API contract

`POST /api/chat`

Request body:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What kind of engineer is Jason?"
    }
  ],
  "metadata": {
    "source": "portfolio-widget",
    "pagePath": "/",
    "sessionId": "3e4b8d6e-1f6b-47d9-bf3f-2f2a0b5937cb"
  }
}
```

Rules:

- `messages` is required and must be a non-empty array
- at most `10` messages are allowed per request
- allowed roles are `user` and `assistant`
- each message may only contain `role` and `content`
- each `content` value must be a string of at most `4000` characters
- the final message must be from `user`
- `metadata` is optional and intended for non-sensitive request context
- allowed metadata keys are `source`, `pagePath`, and `sessionId`
- body must be valid JSON with `Content-Type: application/json`

Success response:

```json
{
  "reply": "Jason comes across as a product-minded full-stack engineer with strong emphasis on grounded execution.",
  "meta": {
    "requestId": "2c68b72c-65b7-4d46-bc26-31fe5d4a6a4d",
    "model": "gpt-4.1-mini",
    "provider": "openai",
    "grounded": true,
    "fallback": false,
    "contractVersion": "2026-04-04"
  }
}
```

Safe fallback response:

```json
{
  "reply": "I don't have enough documented context to answer that confidently yet. You can ask about Jason's projects like Prairie Amber Cattery or CashFlowGo, or about experience, stack, and strengths instead.",
  "meta": {
    "requestId": "173a7c92-2df8-4914-bff0-11e2a71d4704",
    "model": "fallback",
    "provider": "openai",
    "grounded": false,
    "fallback": true,
    "fallbackReason": "provider_failure",
    "contractVersion": "2026-04-04"
  }
}
```

Error response:

```json
{
  "error": {
    "code": "invalid_messages",
    "message": "Request body must include a non-empty messages array."
  },
  "meta": {
    "requestId": "017c53f1-7ec3-42c0-9427-0c5c5a6d37b7",
    "contractVersion": "2026-04-04"
  }
}
```

## Grounding and guardrails

The prompt logic lives in `worker/context.js`, but the source data now lives under `data/portfolio/`. Update those files with real public resume, portfolio, and project facts before launch.

Current guardrails:

- answers stay grounded in structured portfolio context
- concise recruiter-facing tone
- fallback when evidence is missing
- refusal for sensitive personal information or invented claims
- safe recruiter-facing fallback when the provider fails or configuration is missing

## Suggested next steps

1. Replace the placeholder context with real portfolio facts.
2. Add a small ingestion step that builds `worker/context.js` from markdown or JSON source files.
3. Publish `dist/widget.js` and `dist/widget.css` on Cloudflare Pages.
4. Lock down CORS to the portfolio domain once the final hostnames exist.
