import { Command } from "commander";
import ora from "ora";
import { api } from "../api/client.js";
import type { DeviceAuthStartResponse, DeviceAuthPollResponse } from "../api/types.js";
import { saveCredentials } from "../config/store.js";
import { openBrowser } from "../lib/open-browser.js";
import { success, info, fail } from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";
import { POLL_INTERVAL_MS } from "../config/constants.js";

export const loginCommand = new Command("login")
  .description("Sign in to Velobase Cloud")
  .action(async () => {
    try {
      const start = await api.postNoAuth<DeviceAuthStartResponse>(
        "/api/cli/auth/start",
      );

      info(`Your verification code: ${start.userCode}`);
      info("Opening browser to authorize...");

      try {
        await openBrowser(start.verificationUrl);
      } catch {
        info(`Please open this URL manually:\n    ${start.verificationUrl}`);
      }

      const spinner = ora("Waiting for authorization...").start();
      const deadline = new Date(start.expiresAt).getTime();

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        const poll = await api.postNoAuth<DeviceAuthPollResponse>(
          "/api/cli/auth/poll",
          { deviceCode: start.deviceCode },
        );

        if (poll.status === "approved" && poll.token) {
          spinner.stop();
          saveCredentials({
            token: poll.token,
            expiresAt: poll.expiresAt!,
          });
          success("Logged in successfully.");
          return;
        }

        if (poll.status === "expired") {
        spinner.stop();
        fail("Authorization expired. Please try again.");
        return process.exit(1) as never;
      }
    }

      spinner.stop();
      fail("Authorization timed out. Please try again.");
      return process.exit(1) as never;
    } catch (err) {
      handleError(err);
    }
  });
