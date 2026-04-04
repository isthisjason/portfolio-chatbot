import {
  buildRecruiterFallbackReply,
  portfolioContext,
  getFallbackMessage,
} from "./context.js";

const MAX_REPLY_CHARACTERS = 650;
const SENSITIVE_PATTERNS = [
  /\b(phone|cell|mobile|number|email|e-mail|address|home address)\b/i,
  /\b(date of birth|birthday|age|family|married|relationship|girlfriend|boyfriend)\b/i,
  /\b(salary|compensation|pay expectation)\b/i,
  /\b(personal contact|private contact|personal info|personal information)\b/i,
];
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/;

function trimToSentenceBoundary(value, maxCharacters = MAX_REPLY_CHARACTERS) {
  if (value.length <= maxCharacters) {
    return value;
  }

  const truncated = value.slice(0, maxCharacters);
  const boundary = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("? "),
    truncated.lastIndexOf("! "),
  );

  if (boundary > 120) {
    return `${truncated.slice(0, boundary + 1).trim()}`;
  }

  return `${truncated.trim()}...`;
}

function getPublicFactText() {
  return JSON.stringify(portfolioContext).toLowerCase();
}

export function buildSensitiveRefusalReply() {
  return "I can help with Jason's public experience, projects, strengths, and stack, but I can't provide sensitive personal information.";
}

export function isSensitivePersonalQuestion(message) {
  const normalized = String(message || "").trim();
  if (!normalized) {
    return false;
  }

  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function violatesUnsupportedClaimHeuristics(reply) {
  const normalizedReply = String(reply || "").trim();
  if (!normalizedReply) {
    return true;
  }

  const publicFactText = getPublicFactText();

  if (
    EMAIL_PATTERN.test(normalizedReply) &&
    !publicFactText.includes(normalizedReply.match(EMAIL_PATTERN)?.[0]?.toLowerCase() || "")
  ) {
    return true;
  }

  if (
    PHONE_PATTERN.test(normalizedReply) &&
    !publicFactText.includes(normalizedReply.match(PHONE_PATTERN)?.[0]?.toLowerCase() || "")
  ) {
    return true;
  }

  const riskyPhrases = [
    "i built",
    "my experience",
    "his phone number is",
    "his email is",
    "you can reach him at",
  ];

  return riskyPhrases.some((phrase) => normalizedReply.toLowerCase().includes(phrase));
}

export function enforceResponseGuardrails({ userMessage, reply }) {
  if (isSensitivePersonalQuestion(userMessage)) {
    return {
      kind: "refusal",
      reply: buildSensitiveRefusalReply(),
      grounded: true,
      fallback: false,
      guardrailReason: "sensitive_personal_question",
    };
  }

  const normalizedReply = String(reply || "").trim();
  if (!normalizedReply) {
    return {
      kind: "fallback",
      reply: buildRecruiterFallbackReply(),
      grounded: false,
      fallback: true,
      guardrailReason: "empty_reply",
    };
  }

  if (normalizedReply.toLowerCase() === getFallbackMessage().toLowerCase()) {
    return {
      kind: "fallback",
      reply: buildRecruiterFallbackReply(),
      grounded: false,
      fallback: true,
      guardrailReason: "missing_context",
    };
  }

  if (violatesUnsupportedClaimHeuristics(normalizedReply)) {
    return {
      kind: "fallback",
      reply: buildRecruiterFallbackReply(),
      grounded: false,
      fallback: true,
      guardrailReason: "unsupported_claim_risk",
    };
  }

  return {
    kind: "success",
    reply: trimToSentenceBoundary(normalizedReply),
    grounded: true,
    fallback: false,
  };
}
