export class ProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ProviderError";
    this.provider = options.provider || "unknown";
    this.statusCode = options.statusCode;
    this.category = options.category || "provider_failure";
    this.retryable = options.retryable ?? true;
  }
}
