import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { api } from "../api/client.js";
import type { DeploymentLogs, EnvApplyResponse, EnvVar } from "../api/types.js";
import { requireProject } from "../lib/require-project.js";
import { DEPLOY_POLL_INTERVAL_MS, MAX_DEPLOY_WATCH_MS } from "../config/constants.js";
import { heading, success, fail, info, label, dim, stateColor } from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";

const ENV_APPLY_TERMINAL_STATES = new Set([
  "SUCCEEDED", "FAILED", "CANCELLED", "PARTIAL_FAILED", "ROLLED_BACK",
]);

const listCmd = new Command("list")
  .description("List environment variables")
  .option("-s, --service <name>", "Filter by service name")
  .action(async (opts: { service?: string }) => {
    try {
      const config = requireProject();
      const vars = await api.get<EnvVar[]>(
        `/api/cli/projects/${config.projectId}/env`,
        { service: opts.service },
      );

      heading("Environment Variables");
      if (vars.length === 0) {
        info("No environment variables set.");
        return;
      }
      for (const v of vars) {
        console.log(
          `  ${chalk.bold(v.key)} ${chalk.dim(`[${v.scope}]`)}${v.serviceName ? chalk.dim(` (${v.serviceName})`) : ""}`,
        );
        if (v.description) dim(v.description);
      }
      console.log();
      dim(`${vars.length} variable(s)`);
    } catch (err) {
      handleError(err);
    }
  });

const setCmd = new Command("set")
  .alias("add")
  .description("Add or update an environment variable")
  .argument("<key>", "Variable name")
  .argument("<value>", "Variable value")
  .option("-s, --service <name>", "Service name (for multi-service projects)")
  .option("-d, --description <desc>", "Description")
  .action(
    async (
      key: string,
      value: string,
      opts: { service?: string; description?: string },
    ) => {
      try {
        const config = requireProject();
        await api.post(`/api/cli/projects/${config.projectId}/env`, {
          key,
          value,
          serviceName: opts.service,
          description: opts.description,
        });
        success(`Set ${key}`);
        info("Run `velobase-cloud env apply` to roll this change out now.");
      } catch (err) {
        handleError(err);
      }
    },
  );

const deleteCmd = new Command("delete")
  .alias("revoke")
  .description("Delete an environment variable")
  .argument("<key>", "Variable name")
  .option("-s, --service <name>", "Service name")
  .action(async (key: string, opts: { service?: string }) => {
    try {
      const config = requireProject();
      let url = `/api/cli/projects/${config.projectId}/env/${encodeURIComponent(key)}`;
      if (opts.service) url += `?service=${encodeURIComponent(opts.service)}`;

      await api.delete(url);
      success(`Deleted ${key}`);
      info("Run `velobase-cloud env apply` to roll this revocation out now.");
    } catch (err) {
      handleError(err);
    }
  });

const applyCmd = new Command("apply")
  .description("Apply pending environment variable changes")
  .option("--watch", "Watch the rollout until it finishes")
  .action(async (opts: { watch?: boolean }) => {
    try {
      const config = requireProject();
      const spinner = ora("Queuing environment rollout...").start();
      const result = await api.post<EnvApplyResponse>(
        `/api/cli/projects/${config.projectId}/env/apply`,
      );

      spinner.succeed("Environment rollout queued");
      label("Deployment", result.deploymentId.slice(0, 8));

      if (opts.watch) {
        await watchEnvApply(config.projectId, result.deploymentId);
      } else {
        info("Use `velobase-cloud env apply --watch` to follow rollout status.");
      }
    } catch (err) {
      handleError(err);
    }
  });

async function watchEnvApply(projectId: string, deploymentId: string) {
  const spinner = ora("Applying environment changes...").start();
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_DEPLOY_WATCH_MS) {
    await new Promise((r) => setTimeout(r, DEPLOY_POLL_INTERVAL_MS));

    try {
      const dep = await api.get<DeploymentLogs>(
        `/api/cli/projects/${projectId}/deployments/${deploymentId}/logs`,
      );
      spinner.text = `Environment rollout: ${stateColor(dep.status)}`;

      if (ENV_APPLY_TERMINAL_STATES.has(dep.status)) {
        if (dep.status === "SUCCEEDED") {
          spinner.succeed("Environment changes applied");
        } else {
          spinner.fail(`Environment rollout ${dep.status}`);
          if (dep.errorMessage) fail(dep.errorMessage);
        }
        return;
      }
    } catch {
      // Keep watching; transient deploy status reads should not fail the command.
    }
  }

  spinner.warn("Timed out while waiting for environment rollout");
  info(`Deployment ID: ${deploymentId.slice(0, 8)}`);
  info("Run `velobase-cloud status --deploys` to check progress.");
}

export const envCommand = new Command("env")
  .description("Manage environment variables")
  .addCommand(listCmd)
  .addCommand(setCmd)
  .addCommand(deleteCmd)
  .addCommand(applyCmd);
