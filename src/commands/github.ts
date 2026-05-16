import { Command } from "commander";
import ora from "ora";
import { api } from "../api/client.js";
import type { GitHubStatusResponse, GitHubAuthUrlResponse } from "../api/types.js";
import { openBrowser } from "../lib/open-browser.js";
import { success, fail, info, label, heading, warn } from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";
import { POLL_INTERVAL_MS } from "../config/constants.js";

const CONNECT_TIMEOUT_MS = 5 * 60 * 1000;

const connectCmd = new Command("connect")
  .description("Connect your GitHub account")
  .action(async () => {
    try {
      const current = await api.get<GitHubStatusResponse>("/api/cli/github/status");
      if (current.connected && current.hasWorkflowScope) {
        success(`GitHub already connected as @${current.githubUsername}`);
        return;
      }

      if (current.connected && !current.hasWorkflowScope) {
        warn("GitHub connected but missing 'workflow' scope. Re-authorizing...");
      }

      const { authUrl } = await api.get<GitHubAuthUrlResponse>("/api/cli/github/auth-url");
      info("Opening browser for GitHub authorization...");

      try {
        await openBrowser(authUrl);
      } catch {
        info(`Please open this URL manually:\n    ${authUrl}`);
      }

      const spinner = ora("Waiting for GitHub authorization...").start();
      const deadline = Date.now() + CONNECT_TIMEOUT_MS;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const status = await api.get<GitHubStatusResponse>("/api/cli/github/status");
          if (status.connected && status.hasWorkflowScope) {
            spinner.succeed(`GitHub connected as @${status.githubUsername}`);
            return;
          }
        } catch {
          // keep polling
        }
      }

      spinner.fail("Authorization timed out.");
      return process.exit(1) as never;
    } catch (err) {
      handleError(err);
    }
  });

const statusCmd = new Command("status")
  .description("Show GitHub connection status")
  .action(async () => {
    try {
      const status = await api.get<GitHubStatusResponse>("/api/cli/github/status");
      heading("GitHub Connection");
      if (status.connected) {
        label("Status", "Connected");
        label("Username", `@${status.githubUsername}`);
        label("Scope", status.scope ?? "unknown");
        if (!status.hasWorkflowScope) {
          warn("Missing 'workflow' scope — run `velobase-cloud github connect` to fix.");
        }
      } else {
        label("Status", "Not connected");
        info("Run `velobase-cloud github connect` to authorize.");
      }
    } catch (err) {
      handleError(err);
    }
  });

export const githubCommand = new Command("github")
  .description("Manage GitHub connection")
  .addCommand(connectCmd)
  .addCommand(statusCmd);
