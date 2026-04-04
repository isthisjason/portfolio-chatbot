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

- `OPENAI_MODEL`

## Grounding and guardrails

The prompt logic lives in `worker/context.js`. Replace the placeholder data with real resume, portfolio, and project facts before launch.

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
