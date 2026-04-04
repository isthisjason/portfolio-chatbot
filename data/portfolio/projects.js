export const projects = [
  {
    slug: "prairie-amber-cattery",
    name: "Prairie Amber Cattery",
    oneLiner:
      "A production web platform with role-based admin tools and a multi-step application workflow.",
    status: "active",
    stack: [
      "React",
      "TypeScript",
      "TanStack Router",
      "TanStack Start",
      "Tailwind CSS",
      "Node.js",
    ],
    themes: ["full-stack", "security", "production-readiness", "workflow-design"],
    strengthsShown: [
      "Shows production full-stack delivery with end-to-end ownership.",
      "Demonstrates security hardening including server sessions, validation, rate limiting, CSRF and origin protections, and audit logging.",
      "Highlights privacy and reliability thinking through retention purge flows, data export and delete requests, and backup and restore drills.",
    ],
    architecture: [
      "Built around a role-based admin experience and a structured multi-step application workflow.",
      "Includes backend-driven security and operational safeguards suitable for a production-facing web platform.",
    ],
    outcomes: [
      "Shipped a production deployment rather than a local-only project.",
      "Added admin workflows, privacy workflows, and reliability procedures that go beyond a basic brochure site.",
    ],
    links: [
      {
        label: "Live site",
        url: "https://prairieambercattery.com",
      },
    ],
  },
  {
    slug: "cashflowgo",
    name: "CashFlowGo",
    oneLiner:
      "A full-stack finance application built with React and Django around authenticated, profile-based workflows.",
    status: "active",
    stack: [
      "React",
      "Django",
      "Git",
      "Chart.js",
      "HTML",
      "CSS",
    ],
    themes: ["full-stack", "security", "product-workflows", "data-visualization"],
    strengthsShown: [
      "Shows full-stack application development across frontend, backend, and deployment concerns.",
      "Demonstrates security-minded implementation through session auth and CSRF/CORS protections.",
      "Highlights product thinking with transaction tracking, budget management, subscription management, and CSV export.",
    ],
    architecture: [
      "Combines a React frontend with a Django backend and end-to-end API integration.",
      "Uses authenticated profile-based workflows and production-oriented deployment settings across Render and Cloudflare Pages.",
    ],
    outcomes: [
      "Delivered a working finance app with multiple user-facing workflows rather than a single demo screen.",
      "Improved production readiness with rate limiting, secure cookie and header settings, and deployment configuration hardening.",
    ],
    links: [
      {
        label: "GitHub repository",
        url: "https://github.com/isthisjason/cashflowgo",
      },
    ],
  },
];
