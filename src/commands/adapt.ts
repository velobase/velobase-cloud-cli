import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import { api } from "../api/client.js";
import { getProjectConfig, hasProjectConfig } from "../config/project.js";
import { getToken } from "../config/store.js";
import { scanProject } from "../scanner/detect.js";
import { detectHarnessServiceMode } from "../scanner/harness.js";
import { PROJECT_DIR } from "../config/constants.js";
import { success, fail, info, heading, dim, warn } from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";

interface AdaptContextResponse {
  prompt: string;
  checklist: string;
}

function buildHarnessPrompt(cwd: string, multiService: boolean): string {
  const sections = [
    "# Velobase Cloud Deployment — AI Adaptation Guide (Harness Project)",
    "",
    "This project is based on the **Velobase Harness** framework.",
    "Refer to AGENTS.md and FRAMEWORK_GUIDE.md for framework conventions.",
    "",
    "## Official Documentation",
    "",
    "Read the full Velobase Cloud documentation before making changes:",
    "- Documentation index: https://docs.velobase.cloud/llms.txt",
    "- Docs site: https://docs.velobase.cloud/",
    "",
    "## Deployment Constraints",
    "",
    "The following are HARD requirements for Velobase Cloud deployment:",
    "",
    "1. **Dockerfile**: Must exist at project root, expose port **3000**.",
    "2. **Health Check**: `/healthz` endpoint must return 200.",
    "3. **Database**: Prisma migration must run in `docker-entrypoint.sh` before app start.",
    "4. **Environment**: Use `src/env.js` for all env vars. Set `SKIP_ENV_VALIDATION=1` for build stage.",
    "5. **PORT**: App must listen on port 3000 (from env `PORT`, default 3000).",
    "",
  ];

  if (multiService) {
    sections.push(
      "## Multi-Service Mode",
      "",
      "This project uses multi-service Dockerfiles (web/api/worker).",
      "Each service is built and deployed independently.",
      "- Dockerfile.web → Web frontend (Next.js)",
      "- Dockerfile.api → API server (standalone Hono)",
      "- Dockerfile.worker → Background workers",
      "",
      "Ensure each Dockerfile:",
      "- Exposes port 3000",
      "- Runs its own healthcheck endpoint",
      "- Has correct `SERVICE_MODE` env var set",
      "",
    );
  }

  sections.push(
    "## Checklist",
    "",
    "- [ ] Dockerfile exists and builds successfully",
    "- [ ] Port 3000 is exposed and used by the app",
    "- [ ] `/healthz` returns 200",
    "- [ ] `docker-entrypoint.sh` runs `npx prisma migrate deploy`",
    "- [ ] All required env vars documented in `src/env.js`",
    "- [ ] GitHub Actions workflow `.github/workflows/deploy-velobase.yml` present",
    "- [ ] No hardcoded secrets in source code",
    "",
  );

  return sections.join("\n");
}

function buildGenericPrompt(cwd: string, stack: string, language: string): string {
  const sections = [
    `# Velobase Cloud Deployment — AI Adaptation Guide (${stack} / ${language})`,
    "",
    "This is a generic project being adapted for Velobase Cloud deployment.",
    "",
    "## Official Documentation",
    "",
    "Read the full Velobase Cloud documentation before making changes:",
    "- Documentation index: https://docs.velobase.cloud/llms.txt",
    "- Docs site: https://docs.velobase.cloud/",
    "",
    "## Deployment Constraints (HARD requirements)",
    "",
    "1. **Dockerfile**: Must exist at project root.",
    "2. **Port 3000**: App MUST listen on port 3000.",
    "3. **Health Check**: Implement a `GET /healthz` endpoint returning HTTP 200.",
    "4. **Database Init**: If using a database, run migrations in a docker entrypoint, not at app boot.",
    "5. **No Local State**: Use environment variables for all configuration.",
    "",
    "## Recommended Dockerfile Pattern",
    "",
    "```dockerfile",
    "FROM node:20-alpine AS builder",
    "WORKDIR /app",
    "COPY package*.json ./",
    "RUN npm ci",
    "COPY . .",
    "RUN npm run build",
    "",
    "FROM node:20-alpine AS runner",
    "WORKDIR /app",
    "COPY --from=builder /app/dist ./dist",
    "COPY --from=builder /app/node_modules ./node_modules",
    "COPY --from=builder /app/package.json ./",
    "EXPOSE 3000",
    'HEALTHCHECK CMD wget -qO- http://localhost:3000/healthz || exit 1',
    'CMD ["node", "dist/index.js"]',
    "```",
    "",
    "Adjust the Dockerfile pattern to match your stack.",
    "",
    "## Checklist",
    "",
    "- [ ] Dockerfile exists and builds successfully",
    "- [ ] Port 3000 is exposed and used by the app",
    "- [ ] `GET /healthz` returns 200",
    "- [ ] Database migrations run in entrypoint (if applicable)",
    "- [ ] All config via environment variables",
    "- [ ] GitHub Actions workflow `.github/workflows/deploy-velobase.yml` present",
    "- [ ] No hardcoded secrets in source code",
    "",
  ];

  return sections.join("\n");
}

export const adaptCommand = new Command("adapt")
  .description("Generate AI context files for project adaptation")
  .option("--cloud", "Fetch additional Cloud-side context")
  .action(async (opts: { cloud?: boolean }) => {
    try {
      if (!getToken()) {
        fail("Not logged in.");
        info("Run `velobase-cloud login` first.");
        return process.exit(1) as never;
      }

      const cwd = process.cwd();
      if (!hasProjectConfig(cwd)) {
        fail("Project not initialized.");
        info("Run `velobase-cloud init` first.");
        return process.exit(1) as never;
      }

      const config = getProjectConfig(cwd)!;
      heading("Generating AI Adaptation Context");

      const scan = scanProject(cwd);
      const outDir = path.join(cwd, PROJECT_DIR);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      let promptContent: string;
      if (scan.type === "harness") {
        const serviceMode = detectHarnessServiceMode(cwd);
        promptContent = buildHarnessPrompt(cwd, serviceMode.hasMultiDockerfile);
      } else {
        promptContent = buildGenericPrompt(cwd, scan.generic.stack, scan.generic.language);
      }

      // Optionally fetch Cloud-side additional context
      if (opts.cloud) {
        const spinner = ora("Fetching Cloud context...").start();
        try {
          const cloudCtx = await api.get<AdaptContextResponse>(
            `/api/cli/projects/${config.projectId}/adapt-context`,
          );
          if (cloudCtx.prompt) {
            promptContent += "\n\n" + cloudCtx.prompt;
          }
          spinner.succeed("Cloud context merged");
        } catch {
          spinner.warn("Could not fetch Cloud context — using local only");
        }
      }

      fs.writeFileSync(path.join(outDir, "ai-prompt.md"), promptContent, "utf-8");
      success("Generated .velobase/ai-prompt.md");

      // Write .velobase/README to help users
      const readmeContent = [
        "# .velobase/",
        "",
        "This directory contains Velobase Cloud configuration and AI context.",
        "",
        "- `config.json` — Project binding info (do not edit manually)",
        "- `ai-prompt.md` — AI adaptation instructions (feed this to your IDE AI)",
        "",
        "These files are auto-generated by `velobase-cloud` CLI.",
        "",
      ].join("\n");
      fs.writeFileSync(path.join(outDir, "README.md"), readmeContent, "utf-8");

      heading("Next Steps");
      info("Open `.velobase/ai-prompt.md` in your IDE and let AI guide the adaptation.");
      dim("After making changes, run `velobase-cloud doctor` to verify readiness.");

      // Check for obvious gaps
      if (!scan.generic.hasDockerfile && scan.type === "generic") {
        warn("No Dockerfile — AI prompt includes a recommended template.");
      }
      if (!scan.generic.hasHealthEndpoint && scan.type === "generic") {
        warn("No /healthz endpoint detected — this is a required deployment constraint.");
      }
    } catch (err) {
      handleError(err);
    }
  });
