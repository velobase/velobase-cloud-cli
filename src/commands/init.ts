import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import chalk from "chalk";
import { api, withGitHubRetry } from "../api/client.js";
import type {
  CreateProjectResponse,
  GitHubRepo,
  ProjectStatus,
  WorkflowTemplateResponse,
} from "../api/types.js";
import { saveProjectConfig, hasProjectConfig, getProjectConfig } from "../config/project.js";
import { getToken } from "../config/store.js";
import { scanProject } from "../scanner/detect.js";
import { detectHarnessServiceMode } from "../scanner/harness.js";
import { getGitRemote, isGitRepo } from "../scanner/git.js";
import { success, fail, info, heading, label, warn, dim } from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";

export const initCommand = new Command("init")
  .description("Initialize a local project for Velobase Cloud deployment")
  .option("-n, --name <name>", "Project name (defaults to directory name)")
  .option("--force", "Re-initialize even if already configured")
  .action(async (opts: { name?: string; force?: boolean }) => {
    try {
      if (!getToken()) {
        fail("Not logged in.");
        info("Run `velobase-cloud login` first.");
        return process.exit(1) as never;
      }

      const cwd = process.cwd();

      if (hasProjectConfig(cwd) && !opts.force) {
        const existing = getProjectConfig(cwd)!;
        warn(`Already initialized for project ${chalk.bold(existing.subdomain)}`);
        info("Use --force to re-initialize.");
        return;
      }

      if (!isGitRepo(cwd)) {
        fail("Not a git repository. Please run `git init` first.");
        return process.exit(1) as never;
      }

      const remote = getGitRemote(cwd);
      if (!remote) {
        fail("No GitHub remote found. Please add a GitHub origin.");
        info("  git remote add origin https://github.com/<owner>/<repo>.git");
        return process.exit(1) as never;
      }

      heading("Project Scan");
      const scan = scanProject(cwd);
      label("Type", scan.type === "harness" ? "Velobase Harness" : "Generic");

      if (scan.type === "harness") {
        dim(`Score: ${scan.harness.score} (matched: ${scan.harness.matched.join(", ")})`);
        const serviceMode = detectHarnessServiceMode(cwd);
        if (serviceMode.hasMultiDockerfile) {
          label("Service Mode", "Multi-service");
          dim(`Dockerfiles: ${serviceMode.dockerfiles.join(", ")}`);
        } else {
          label("Service Mode", "Single");
        }
      } else {
        label("Stack", scan.generic.stack);
        label("Language", scan.generic.language);
        if (!scan.generic.hasDockerfile) {
          warn("No Dockerfile found — the adapt command will help generate one.");
        }
      }

      heading("Creating Cloud Project");
      const projectName = opts.name ?? path.basename(cwd);

      const spinner = ora("Creating project...").start();

      const created = await withGitHubRetry(() =>
        api.post<CreateProjectResponse>("/api/cli/projects", {
          name: projectName,
          githubRepo: remote.fullName,
          projectType: scan.type,
        }),
      );

      spinner.succeed("Project created");
      label("Project ID", created.projectId);
      label("Subdomain", created.subdomain);
      label("URL", created.url);
      if (created.projectEntitlement) {
        label(
          "Project Slot",
          `${created.projectEntitlement.sourceType.toLowerCase()} · ${created.projectEntitlement.status.toLowerCase()}`,
        );
        label("Valid Until", created.projectEntitlement.expiresAt);
      }
      label("App Budget", `${created.appBudget.cpu} CPU / ${created.appBudget.memory} memory`);
      label("API Key", created.apiKey.rawKey);
      warn("Save this API key — it is shown only once.");

      // Write workflow template
      heading("Setting Up GitHub Actions");
      const workflowSpinner = ora("Fetching workflow template...").start();

      const templates = await api.get<WorkflowTemplateResponse>(
        `/api/cli/projects/${created.projectId}/workflow-template`,
      );

      const serviceMode = detectHarnessServiceMode(cwd);
      const workflowContent =
        scan.type === "harness" && serviceMode.hasMultiDockerfile
          ? templates.multi
          : templates.single;

      const workflowDir = path.join(cwd, ".github", "workflows");
      if (!fs.existsSync(workflowDir)) {
        fs.mkdirSync(workflowDir, { recursive: true });
      }

      const workflowFile = path.join(workflowDir, "deploy-velobase.yml");
      fs.writeFileSync(workflowFile, workflowContent, "utf-8");
      workflowSpinner.succeed("Workflow file written");
      dim(`.github/workflows/deploy-velobase.yml`);

      // Set GitHub Secrets via Cloud API
      const secretSpinner = ora("Configuring GitHub secrets...").start();
      try {
        await withGitHubRetry(() =>
          api.post(`/api/cli/projects/${created.projectId}/setup-secrets`, {
            githubRepo: remote.fullName,
            apiKey: created.apiKey.rawKey,
          }),
        );
        secretSpinner.succeed("GitHub secrets configured");
      } catch (err) {
        secretSpinner.warn("Could not auto-configure GitHub secrets");
        info("Set VELOBASE_API_KEY manually in your GitHub repo settings using the key above.");
      }

      // Save local project config
      saveProjectConfig(
        {
          projectId: created.projectId,
          tenantId: created.tenantId,
          subdomain: created.subdomain,
          url: created.url,
          projectType: scan.type,
          githubRepo: remote.fullName,
          createdAt: new Date().toISOString(),
        },
        cwd,
      );

      // Wait for cloud resource provisioning to complete
      heading("Provisioning Cloud Resources");
      const provSpinner = ora("Provisioning cloud resources...").start();
      const maxWait = 120_000;
      const interval = 3_000;
      const provStart = Date.now();
      let provDone = false;
      while (Date.now() - provStart < maxWait) {
        try {
          const s = await api.get<ProjectStatus>(
            `/api/cli/projects/${created.projectId}/status`,
          );
          if (s.project.status === "ACTIVE") {
            provSpinner.succeed("Cloud resources provisioned (PG, Redis, K8s, R2, Ingress)");
            provDone = true;
            break;
          }
          if (s.project.provisioningError) {
            provSpinner.fail(`Provisioning failed: ${s.project.provisioningError}`);
            info("You can reset the project in the web console and retry with `velobase-cloud init --force`.");
            provDone = true;
            break;
          }
          const step = s.project.provisioningStep ?? "starting";
          provSpinner.text = `Provisioning: ${step}...`;
        } catch {
          // Transient network error — keep polling
        }
        await new Promise((r) => setTimeout(r, interval));
      }
      if (!provDone) {
        provSpinner.warn("Provisioning still in progress. Run `velobase-cloud status` to check.");
      }

      heading("Done");
      success("Project initialized for Velobase Cloud.");
      info("Next steps:");
      dim("1. velobase-cloud adapt    — Generate AI context for project adaptation");
      dim("2. velobase-cloud doctor   — Check deployment readiness");
      dim("3. git push                — Trigger deployment via GitHub Actions");
    } catch (err) {
      handleError(err);
    }
  });
