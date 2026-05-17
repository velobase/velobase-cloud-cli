import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { api, withGitHubRetry } from "../api/client.js";
import type { WorkflowRun, WorkflowJob, DeploymentSummary, DeploymentLogs } from "../api/types.js";
import { requireProject } from "../lib/require-project.js";
import {
  heading,
  label,
  success,
  fail,
  info,
  dim,
  stateColor,
  relativeTime,
} from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";
import { POLL_INTERVAL_MS, DEPLOY_POLL_INTERVAL_MS, MAX_DEPLOY_WATCH_MS } from "../config/constants.js";

const triggerCmd = new Command("trigger")
  .description("Trigger a deployment via GitHub Actions")
  .option("-b, --branch <branch>", "Branch to deploy", "main")
  .option("--watch", "Watch workflow execution")
  .action(async (opts: { branch: string; watch?: boolean }) => {
    try {
      const config = requireProject();

      const spinner = ora("Triggering deployment workflow...").start();
      const result = await withGitHubRetry(() =>
        api.post<{ workflowRunId: number }>(
          `/api/cli/projects/${config.projectId}/deploy/trigger`,
          { branch: opts.branch },
        ),
      );
      spinner.succeed("Workflow triggered");

      let runId = result.workflowRunId;

      if (runId === 0 && opts.watch) {
        const resolveSpinner = ora("Resolving workflow run ID...").start();
        for (let attempt = 0; attempt < 6; attempt++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          try {
            const runs = await api.get<WorkflowRun[]>(
              `/api/cli/projects/${config.projectId}/workflow/runs?limit=1`,
            );
            if (runs.length > 0) {
              runId = runs[0]!.id;
              break;
            }
          } catch {
            // retry
          }
        }
        if (runId === 0) {
          resolveSpinner.fail("Could not determine workflow run ID");
          info("Check status with `velobase-cloud deploy runs`.");
          return;
        }
        resolveSpinner.succeed(`Found workflow run #${runId}`);
      }

      if (runId > 0) {
        label("Workflow Run", `#${runId}`);
      }

      if (opts.watch) {
        await watchWorkflow(config.projectId, runId);
      } else {
        info("Use --watch to follow execution, or run `velobase-cloud deploy runs`.");
      }
    } catch (err) {
      handleError(err);
    }
  });

const DEPLOY_TERMINAL_STATES = new Set([
  "SUCCEEDED", "FAILED", "CANCELLED", "PARTIAL_FAILED", "ROLLED_BACK",
]);

async function watchWorkflow(projectId: string, runId: number) {
  const spinner = ora("Watching workflow...").start();

  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const run = await api.get<WorkflowRun>(
        `/api/cli/projects/${projectId}/workflow/runs/${runId}`,
      );

      spinner.text = `Workflow ${stateColor(run.status)}${run.conclusion ? ` → ${stateColor(run.conclusion)}` : ""}`;

      if (run.status === "completed") {
        if (run.conclusion === "success") {
          spinner.succeed("GitHub Actions workflow completed");
          await watchCloudDeployment(projectId);
        } else {
          spinner.fail(`Workflow ${run.conclusion ?? "failed"}`);
          info(`Details: ${run.htmlUrl}`);
        }
        return;
      }
    } catch {
      // keep polling
    }
  }
}

async function watchCloudDeployment(projectId: string) {
  const spinner = ora("Tracking Cloud deployment status...").start();
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_DEPLOY_WATCH_MS) {
    await new Promise((r) => setTimeout(r, DEPLOY_POLL_INTERVAL_MS));

    try {
      const dep = await api.get<DeploymentLogs>(
        `/api/cli/projects/${projectId}/deployments/latest`,
      );
      if (!dep) continue;

      spinner.text = `Cloud deployment: ${stateColor(dep.status)}`;

      if (DEPLOY_TERMINAL_STATES.has(dep.status)) {
        if (dep.status === "SUCCEEDED") {
          spinner.succeed("Cloud deployment succeeded");
        } else {
          spinner.fail(`Cloud deployment ${dep.status}`);
          if (dep.errorMessage) fail(dep.errorMessage);
        }
        return;
      }
    } catch {
      // keep polling
    }
  }

  let currentStatus = "unknown";
  let deployId = "";
  try {
    const dep = await api.get<DeploymentLogs>(
      `/api/cli/projects/${projectId}/deployments/latest`,
    );
    currentStatus = dep.status;
    deployId = dep.id;
  } catch { /* ignore */ }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  spinner.warn(`Timed out after ${elapsed}s — deployment still ${currentStatus}`);
  if (deployId) info(`Deployment ID: ${deployId.slice(0, 8)}`);
  info("This does not mean failure. Run `velobase-cloud deploy status` to check progress.");
}

const runsCmd = new Command("runs")
  .description("List recent workflow runs")
  .option("-l, --limit <n>", "Number of runs", "5")
  .action(async (opts: { limit: string }) => {
    try {
      const config = requireProject();
      const runs = await withGitHubRetry(() =>
        api.get<WorkflowRun[]>(
          `/api/cli/projects/${config.projectId}/workflow/runs?limit=${opts.limit}`,
        ),
      );

      heading("Workflow Runs");
      if (runs.length === 0) {
        info("No workflow runs found.");
        return;
      }
      for (const run of runs) {
        const conclusion = run.conclusion ? stateColor(run.conclusion) : chalk.dim("pending");
        console.log(
          `  #${run.id} ${stateColor(run.status)} ${conclusion} — ${run.displayTitle} ${chalk.dim(relativeTime(run.createdAt))}`,
        );
      }
    } catch (err) {
      handleError(err);
    }
  });

const jobsCmd = new Command("jobs")
  .description("Show jobs for a workflow run")
  .argument("<run-id>", "Workflow run ID")
  .action(async (runId: string) => {
    try {
      const config = requireProject();
      const jobs = await api.get<WorkflowJob[]>(
        `/api/cli/projects/${config.projectId}/workflow/runs/${runId}/jobs`,
      );

      heading(`Jobs for Run #${runId}`);
      for (const job of jobs) {
        console.log(
          `  ${stateColor(job.status)} ${chalk.bold(job.name)}${job.conclusion ? ` → ${stateColor(job.conclusion)}` : ""}`,
        );
        for (const step of job.steps) {
          const icon = step.conclusion === "success" ? chalk.green("✓") : step.conclusion === "failure" ? chalk.red("✗") : chalk.dim("○");
          dim(`    ${icon} ${step.name}`);
        }
      }
    } catch (err) {
      handleError(err);
    }
  });

const rollbackCmd = new Command("rollback")
  .description("Rollback to a previous deployment")
  .argument("<deployment-id>", "Target deployment ID to rollback to")
  .action(async (deploymentId: string) => {
    try {
      const config = requireProject();
      const spinner = ora("Rolling back...").start();

      const result = await api.post<DeploymentSummary>(
        `/api/cli/projects/${config.projectId}/deployments/${deploymentId}/rollback`,
      );

      spinner.succeed("Rollback initiated");
      label("New Deployment", result.id.slice(0, 8));
      label("Status", stateColor(result.status));
      label("Image", result.imageTag);
    } catch (err) {
      handleError(err);
    }
  });

const cancelCmd = new Command("cancel")
  .description("Cancel a running deployment")
  .argument("[deployment-id]", "Deployment ID (defaults to latest)")
  .action(async (deploymentId?: string) => {
    try {
      const config = requireProject();
      const id = deploymentId ?? "latest";
      const spinner = ora("Cancelling deployment...").start();

      await api.post(
        `/api/cli/projects/${config.projectId}/deployments/${id}/cancel`,
      );

      spinner.succeed("Deployment cancelled");
    } catch (err) {
      handleError(err);
    }
  });

export const deployCommand = new Command("deploy")
  .description("Manage deployments")
  .addCommand(triggerCmd)
  .addCommand(runsCmd)
  .addCommand(jobsCmd)
  .addCommand(rollbackCmd)
  .addCommand(cancelCmd);
