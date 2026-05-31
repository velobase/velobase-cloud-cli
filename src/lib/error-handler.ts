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
    } else if (isBillingError(err)) {
      fail(err.message || "Project billing action required.");
      const price = typeof err.details?.price === "string" ? err.details.price : "$59.90/month";
      const billingUrl = typeof err.details?.billingUrl === "string" ? err.details.billingUrl : undefined;
      info(`Velobase Cloud projects are billed per project slot (${price}).`);
      if (err.code === "PROJECT_OVERDUE") {
        info("Restore the project subscription before deploying or applying changes.");
      } else {
        info("Purchase a project slot, then run `velobase-cloud init` again.");
      }
      if (billingUrl) info(`Billing page: ${billingUrl}`);
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

function isBillingError(err: ApiError) {
  return err.status === 402
    || err.code === "PROJECT_ENTITLEMENT_REQUIRED"
    || err.code === "PROJECT_TRIALS_USED_UP"
    || err.code === "PROJECT_OVERDUE"
    || err.code === "APP_BUDGET_EXCEEDED";
}
