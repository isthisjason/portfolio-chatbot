import {
  buildSensitiveRefusalReply,
  enforceResponseGuardrails,
  isSensitivePersonalQuestion,
} from "../worker/guardrails.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pass(name) {
  console.log(`PASS ${name}`);
}

function testSensitiveQuestionRefusal() {
  const question = "What is Jason's phone number and personal email?";
  assert(
    isSensitivePersonalQuestion(question),
    "Sensitive personal question should be detected",
  );

  const result = enforceResponseGuardrails({
    userMessage: question,
    reply: "His phone number is 555-555-5555.",
  });

  assert(result.kind === "refusal", "Sensitive question should refuse");
  assert(
    result.reply === buildSensitiveRefusalReply(),
    "Sensitive refusal should use the guardrail response",
  );
  pass("sensitive personal questions get a safe refusal");
}

function testMissingContextFallback() {
  const result = enforceResponseGuardrails({
    userMessage: "What patents does Jason hold?",
    reply: "I don't have enough documented context to answer that confidently yet.",
  });

  assert(result.kind === "fallback", "Missing context should produce fallback");
  assert(result.fallback === true, "Fallback flag should be true");
  pass("missing-context questions get an honest fallback");
}

function testUnsupportedClaimsFallback() {
  const result = enforceResponseGuardrails({
    userMessage: "How can I contact Jason directly?",
    reply: "You can reach him at secret-email@example.com.",
  });

  assert(
    result.kind === "fallback" || result.kind === "refusal",
    "Unsupported sensitive claim should not pass through as success",
  );
  pass("unsupported claims are blocked");
}

function testConciseRecruiterAppropriateResponse() {
  const longReply = `${"Jason is a strong engineer with practical full-stack experience. ".repeat(30)}He has shipped production applications.`;
  const result = enforceResponseGuardrails({
    userMessage: "What kind of engineer is Jason?",
    reply: longReply,
  });

  assert(result.kind === "success", "Supported answer should remain successful");
  assert(result.reply.length <= 653, "Reply should be trimmed to concise length");
  assert(!result.reply.toLowerCase().includes("i built"), "Reply should avoid first-person risky phrasing");
  pass("responses are concise and recruiter-appropriate");
}

function run() {
  testSensitiveQuestionRefusal();
  testMissingContextFallback();
  testUnsupportedClaimsFallback();
  testConciseRecruiterAppropriateResponse();
  console.log("Guardrail checks passed.");
}

run();
