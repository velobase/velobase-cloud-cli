import { Command } from "commander";
import chalk from "chalk";
import { api } from "../api/client.js";
import type { EnvVar } from "../api/types.js";
import { requireProject } from "../lib/require-project.js";
import { heading, success, fail, info, label, dim } from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";

const listCmd = new Command("list")
  .description("List environment variables")
  .option("-s, --service <name>", "Filter by service name")
  .action(async (opts: { service?: string }) => {
    try {
      const config = requireProject();
      let url = `/api/cli/projects/${config.projectId}/env`;
      if (opts.service) url += `?service=${opts.service}`;

      const vars = await api.get<EnvVar[]>(url);

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
  .description("Set an environment variable")
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
        info("Changes will take effect on next deployment or restart.");
      } catch (err) {
        handleError(err);
      }
    },
  );

const deleteCmd = new Command("delete")
  .description("Delete an environment variable")
  .argument("<key>", "Variable name")
  .option("-s, --service <name>", "Service name")
  .action(async (key: string, opts: { service?: string }) => {
    try {
      const config = requireProject();
      let url = `/api/cli/projects/${config.projectId}/env/${encodeURIComponent(key)}`;
      if (opts.service) url += `?service=${opts.service}`;

      await api.delete(url);
      success(`Deleted ${key}`);
      info("Changes will take effect on next deployment or restart.");
    } catch (err) {
      handleError(err);
    }
  });

export const envCommand = new Command("env")
  .description("Manage environment variables")
  .addCommand(listCmd)
  .addCommand(setCmd)
  .addCommand(deleteCmd);
