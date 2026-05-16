import { Command } from "commander";
import chalk from "chalk";
import { api, withGitHubRetry } from "../api/client.js";
import type {
  PodInfo,
  PodLogsResponse,
  PodEventsResponse,
  DeploymentLogs,
} from "../api/types.js";
import { requireProject } from "../lib/require-project.js";
import { heading, label, fail, info, dim, stateColor } from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";

const podListCmd = new Command("pods")
  .description("List running pods")
  .action(async () => {
    try {
      const config = requireProject();
      const pods = await api.get<PodInfo[]>(
        `/api/cli/projects/${config.projectId}/pods`,
      );

      heading("Pods");
      if (pods.length === 0) {
        info("No pods found.");
        return;
      }
      for (const pod of pods) {
        const ready = pod.ready ? chalk.green("✓") : chalk.red("✗");
        const restarts =
          pod.restartCount > 0 ? chalk.yellow(` (${pod.restartCount} restarts)`) : "";
        console.log(
          `  ${ready} ${chalk.bold(pod.name)} [${pod.serviceName}] ${stateColor(pod.phase)}${restarts}`,
        );
      }
    } catch (err) {
      handleError(err);
    }
  });

const podLogsCmd = new Command("pod")
  .description("Show logs for a specific pod")
  .argument("<pod-name>", "Pod name")
  .option("-t, --tail <lines>", "Number of tail lines", "100")
  .action(async (podName: string, opts: { tail?: string }) => {
    try {
      const config = requireProject();
      const logs = await api.get<PodLogsResponse>(
        `/api/cli/projects/${config.projectId}/pods/${podName}/logs?tail=${opts.tail ?? "100"}`,
      );

      heading(`Logs: ${podName}`);
      if (logs.log) {
        console.log(logs.log);
      } else {
        info("No logs available.");
      }
    } catch (err) {
      handleError(err);
    }
  });

const podEventsCmd = new Command("events")
  .description("Show events for a specific pod")
  .argument("<pod-name>", "Pod name")
  .action(async (podName: string) => {
    try {
      const config = requireProject();
      const resp = await api.get<PodEventsResponse>(
        `/api/cli/projects/${config.projectId}/pods/${podName}/events`,
      );

      heading(`Events: ${podName}`);
      if (resp.events.length === 0) {
        info("No events.");
        return;
      }
      for (const ev of resp.events) {
        const count = ev.count > 1 ? chalk.dim(` (×${ev.count})`) : "";
        console.log(`  ${chalk.yellow(ev.reason)}${count} — ${ev.message}`);
        dim(ev.lastTimestamp);
      }
    } catch (err) {
      handleError(err);
    }
  });

const deployLogsCmd = new Command("deploy")
  .description("Show logs for a deployment")
  .argument("[deployment-id]", "Deployment ID (defaults to latest)")
  .action(async (deploymentId?: string) => {
    try {
      const config = requireProject();
      const idParam = deploymentId ?? "latest";
      const logs = await api.get<DeploymentLogs>(
        `/api/cli/projects/${config.projectId}/deployments/${idParam}/logs`,
      );

      heading(`Deployment Logs: ${logs.id.slice(0, 8)} (${stateColor(logs.status)})`);
      if (logs.deployLogs) {
        console.log(logs.deployLogs);
      } else {
        info("No deploy logs available.");
      }
      if (logs.errorMessage) {
        console.log();
        fail(logs.errorMessage);
      }
    } catch (err) {
      handleError(err);
    }
  });

export const logsCommand = new Command("logs")
  .description("View logs for pods and deployments")
  .addCommand(podListCmd)
  .addCommand(podLogsCmd)
  .addCommand(podEventsCmd)
  .addCommand(deployLogsCmd);
