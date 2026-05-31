import { Command } from "commander";
import { api } from "../api/client.js";
import type { BillingStatus } from "../api/types.js";
import { heading, label, info } from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";

export const billingCommand = new Command("billing")
  .description("Show Velobase Cloud project slot billing status")
  .option("--json", "Print machine-readable JSON for automation/agents")
  .action(async (opts: { json?: boolean }) => {
    try {
      const billing = await api.get<BillingStatus>("/api/cli/billing");

      if (opts.json) {
        console.log(JSON.stringify(billing, null, 2));
        return;
      }

      heading("Project Billing");
      label("Model", "Project monthly");
      label("Price", billing.price);
      label("Active Slots", String(billing.slots.active));
      label("Available Slots", String(billing.slots.available));
      label("Initializing Slots", String(billing.slots.initializing));
      label("Trial Slots", `${billing.slots.trialUsed}/${billing.slots.trialLimit} used`);
      label("Trial Remaining", String(billing.slots.trialRemaining));
      label("Included App Budget", `${billing.included.appCpu} CPU / ${billing.included.appMemory} memory`);
      label("Redis", billing.included.redis);
      label("PostgreSQL", billing.included.postgres);

      if (billing.recommendedAction === "purchase_project_slot") {
        info(`Purchase a project slot: ${billing.billingUrl}`);
      } else {
        info("You have an available project slot. Run `velobase-cloud init` to use it.");
      }
    } catch (err) {
      handleError(err);
    }
  });
