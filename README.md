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

Set the OpenAI API key before deploying:

```bash
wrangler secret put OPENAI_API_KEY
```

Optional environment variables:

- `AI_PROVIDER` with `openai` as the current implemented default
- `OPENAI_MODEL`

Provider notes:

- the Worker now calls providers through a shared abstraction in `worker/providers/`
- `openai` is implemented today
- `anthropic` is scaffolded behind the same interface but not implemented yet

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
    "grounded": true,
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

## Suggested next steps

1. Replace the placeholder context with real portfolio facts.
2. Add a small ingestion step that builds `worker/context.js` from markdown or JSON source files.
3. Publish `dist/widget.js` and `dist/widget.css` on Cloudflare Pages.
4. Lock down CORS to the portfolio domain once the final hostnames exist.
