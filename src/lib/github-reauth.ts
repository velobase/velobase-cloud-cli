import ora from "ora";
import { api } from "../api/client.js";
import type { GitHubAuthUrlResponse, GitHubStatusResponse } from "../api/types.js";
import { openBrowser } from "./open-browser.js";
import { fail, info } from "./format.js";
import { POLL_INTERVAL_MS } from "../config/constants.js";

const REAUTH_TIMEOUT_MS = 5 * 60 * 1000;

const MESSAGES: Record<string, string> = {
  GITHUB_NOT_CONNECTED: "GitHub account not connected.",
  GITHUB_TOKEN_EXPIRED: "GitHub authorization has expired.",
  GITHUB_SCOPE_INSUFFICIENT: "GitHub authorization missing required 'workflow' scope.",
};

export async function promptGitHubReauth(errorCode: string): Promise<void> {
  console.log();
  fail(MESSAGES[errorCode] ?? "GitHub authorization required.");
  info("Opening browser for GitHub authorization...");

  const { authUrl } = await api.get<GitHubAuthUrlResponse>(
    "/api/cli/github/auth-url",
  );

  try {
    await openBrowser(authUrl);
  } catch {
    info(`Please open this URL manually:\n    ${authUrl}`);
  }

  const spinner = ora("Waiting for GitHub authorization...").start();

  const deadline = Date.now() + REAUTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const status = await api.get<GitHubStatusResponse>(
        "/api/cli/github/status",
      );
      if (status.connected && status.hasWorkflowScope) {
        spinner.succeed(`GitHub connected as @${status.githubUsername}`);
        return;
      }
    } catch {
      // keep polling
    }
  }

  spinner.fail("GitHub authorization timed out.");
  throw new Error("GitHub authorization timed out. Please try again.");
}
