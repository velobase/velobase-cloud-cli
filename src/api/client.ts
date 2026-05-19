import { getToken, clearCredentials } from "../config/store.js";
import { getGlobalConfig } from "../config/store.js";
import { ApiError } from "./errors.js";
import type { ApiErrorResponse } from "./types.js";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  noAuth?: boolean;
}

function buildUrl(
  base: string,
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const url = new URL(path, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseErrorBody(res: Response): Promise<ApiErrorResponse> {
  try {
    return (await res.json()) as ApiErrorResponse;
  } catch {
    return { error: res.statusText, code: `HTTP_${res.status}` };
  }
}

async function rawRequest<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const config = getGlobalConfig();
  const { method = "GET", body, query, noAuth } = opts;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (!noAuth) {
    const token = getToken();
    if (!token) {
      throw new ApiError(401, "CLI_TOKEN_MISSING", "Not logged in. Run `velobase-cloud login` first.");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const url = buildUrl(config.apiBase, path, query);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }

      const errBody = await parseErrorBody(res);
      const code = errBody.code ?? `HTTP_${res.status}`;
      const msg = errBody.error ?? res.statusText;

      if (res.status === 401) {
        clearCredentials();
      }

      // Rate limited — wait and retry once using server-provided Retry-After
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const waitSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5;
        const waitMs = Math.min(waitSec * 1000, 60_000);
        lastError = new ApiError(429, code, msg);
        await sleep(waitMs);
        continue;
      }

      if (res.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new ApiError(res.status, code, msg);
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
        continue;
      }

      throw new ApiError(res.status, code, msg);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Network error — retry
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
        continue;
      }
      throw new ApiError(0, "NETWORK_ERROR", `Network error: ${(err as Error).message}`);
    }
  }
  throw lastError;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Public API client ──

export const api = {
  get<T>(path: string, query?: Record<string, string | number | undefined>) {
    return rawRequest<T>(path, { query });
  },

  post<T>(path: string, body?: unknown) {
    return rawRequest<T>(path, { method: "POST", body });
  },

  delete<T>(path: string) {
    return rawRequest<T>(path, { method: "DELETE" });
  },

  /** For auth endpoints that don't need a CLI token */
  postNoAuth<T>(path: string, body?: unknown) {
    return rawRequest<T>(path, { method: "POST", body, noAuth: true });
  },
};

// ── GitHub retry wrapper ──

import { promptGitHubReauth } from "../lib/github-reauth.js";

/**
 * Wraps an async operation that may fail with a GitHub auth error.
 * On 412 GITHUB_*, automatically prompts browser re-auth, then retries once.
 */
export async function withGitHubRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError && err.isGitHubError) {
      await promptGitHubReauth(err.code);
      return await fn();
    }
    throw err;
  }
}
