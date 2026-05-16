import { Command } from "commander";
import chalk from "chalk";
import { api, withGitHubRetry } from "../api/client.js";
import type { ProjectStatus, DeploymentSummary } from "../api/types.js";
import { requireProject } from "../lib/require-project.js";
import {
  heading,
  label,
  stateColor,
  relativeTime,
  dim,
  info,
  success,
  fail,
} from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";

export const statusCommand = new Command("status")
  .description("Show project deployment and runtime status")
  .option("--deploys", "Include recent deployments")
  .action(async (opts: { deploys?: boolean }) => {
    try {
      const config = requireProject();

      const status = await withGitHubRetry(() =>
        api.get<ProjectStatus>(
          `/api/cli/projects/${config.projectId}/status`,
        ),
      );

      heading("Project Status");
      label("Project", `${status.project.name} (${status.project.subdomain})`);
      label("URL", status.project.url);
      label("Status", stateColor(status.project.status));

      // Runtime
      heading("Runtime");
      label("State", stateColor(status.runtime.state));
      for (const svc of status.runtime.services) {
        const ready = `${svc.podsReady}/${svc.podsDesired}`;
        const restarts = svc.restartCount > 0 ? chalk.yellow(` (${svc.restartCount} restarts)`) : "";
        console.log(
          `  ${stateColor(svc.state)} ${chalk.bold(svc.name)} — pods: ${ready}${restarts}`,
        );
        dim(`  CPU: ${svc.cpuMillicores}m  Memory: ${svc.memoryMB}MB`);
      }

      // Health
      if (status.health.latest) {
        heading("Health Check");
        const hc = status.health.latest;
        if (hc.status === 200) {
          success(`/healthz → ${hc.status} (${hc.latencyMs}ms) ${relativeTime(hc.checkedAt)}`);
        } else {
          fail(`/healthz → ${hc.status} (${hc.latencyMs}ms) ${relativeTime(hc.checkedAt)}`);
        }
        label("30d success rate", `${(status.health.successRate30d * 100).toFixed(1)}%`);
      }

      // Latest deployment
      if (status.project.latestDeploy) {
        const d = status.project.latestDeploy;
        heading("Latest Deployment");
        label("ID", d.id.slice(0, 8));
        label("Status", stateColor(d.status));
        label("Image", d.imageTag);
        label("Created", relativeTime(d.createdAt));
      }

      // Recent deployments list
      if (opts.deploys) {
        const deploys = await api.get<DeploymentSummary[]>(
          `/api/cli/projects/${config.projectId}/deployments?limit=10`,
        );
        heading("Recent Deployments");
        if (deploys.length === 0) {
          info("No deployments yet.");
        } else {
          for (const d of deploys) {
            const sha = d.commitSha ? d.commitSha.slice(0, 7) : "—";
            console.log(
              `  ${stateColor(d.status)} ${d.id.slice(0, 8)} ${chalk.dim(d.imageTag)} ${sha} ${chalk.dim(relativeTime(d.createdAt))}`,
            );
          }
        }
      }
    } catch (err) {
      handleError(err);
    }
  });
