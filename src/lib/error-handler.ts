import { ApiError } from "../api/errors.js";
import { fail, info } from "./format.js";

export function handleError(err: unknown): never {
  if (err instanceof ApiError) {
    if (err.isAuthError) {
      fail("Session expired or invalid.");
      info("Run `velobase-cloud login` to sign in again.");
    } else if (err.isForbidden) {
      fail(err.message || "Access denied.");
      info("You may have exceeded your resource quota or your account may be suspended.");
    } else if (err.isRateLimit) {
      fail("Too many requests. Please wait a moment and try again.");
    } else {
      fail(err.message || `API error (${err.status})`);
    }
  } else if (err instanceof Error) {
    fail(err.message);
  } else {
    fail("An unexpected error occurred.");
  }
  process.exit(1);
}
