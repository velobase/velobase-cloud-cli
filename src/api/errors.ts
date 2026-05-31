export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isGitHubError(): boolean {
    return this.status === 412 && GITHUB_CODES.has(this.code);
  }

  get isRateLimit(): boolean {
    return this.status === 429;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

const GITHUB_CODES = new Set([
  "GITHUB_NOT_CONNECTED",
  "GITHUB_TOKEN_EXPIRED",
  "GITHUB_SCOPE_INSUFFICIENT",
]);
