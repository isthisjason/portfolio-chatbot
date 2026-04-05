import { useEffect } from "react";

const WIDGET_SCRIPT_ID = "portfolio-chatbot-widget-script";

/**
 * Minimal TanStack/Vite integration example:
 * mount this near your app root so the script loads once.
 */
export function PortfolioChatbotEmbed() {
  useEffect(() => {
    window.PortfolioChatbotConfig = {
      apiBaseUrl:
        import.meta.env.MODE === "production"
          ? "https://chatbot-assistant-api.<your-cloudflare-subdomain>.workers.dev"
          : "https://chatbot-assistant-api-preview.<your-cloudflare-subdomain>.workers.dev",
      title: "Ask Jason",
      subtitle: "Ask about experience, projects, strengths, and stack.",
    };

    if (document.getElementById(WIDGET_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = WIDGET_SCRIPT_ID;
    script.src = "https://your-widget-cdn.example.com/widget.js";
    script.defer = true;
    script.dataset.apiBaseUrl = window.PortfolioChatbotConfig.apiBaseUrl;
    document.body.appendChild(script);
  }, []);

  return null;
}

declare global {
  interface Window {
    PortfolioChatbotConfig?: {
      apiBaseUrl?: string;
      title?: string;
      subtitle?: string;
      starterQuestions?: string[] | string;
    };
  }
}
