import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { heading, success, fail, warn, dim, info } from "../lib/format.js";
import { scanProject } from "../scanner/detect.js";

interface Check {
  name: string;
  run: (cwd: string) => CheckResult;
}

interface CheckResult {
  pass: boolean;
  message: string;
  hint?: string;
}

function fileExists(cwd: string, rel: string): boolean {
  return fs.existsSync(path.join(cwd, rel));
}

function fileContains(cwd: string, rel: string, needle: string): boolean {
  try {
    return fs.readFileSync(path.join(cwd, rel), "utf-8").includes(needle);
  } catch {
    return false;
  }
}

const CHECKS: Check[] = [
  {
    name: "Dockerfile exists",
    run: (cwd) => {
      const has =
        fileExists(cwd, "Dockerfile") ||
        fileExists(cwd, "Dockerfile.web");
      return {
        pass: has,
        message: has ? "Dockerfile found" : "No Dockerfile found",
        hint: "Create a Dockerfile at the project root. Run `velobase-cloud adapt` for a template.",
      };
    },
  },
  {
    name: "Port 3000 exposed",
    run: (cwd) => {
      const files = ["Dockerfile", "Dockerfile.web", "Dockerfile.api", "Dockerfile.worker"];
      for (const f of files) {
        if (fileContains(cwd, f, "3000")) {
          return { pass: true, message: `Port 3000 referenced in ${f}` };
        }
      }
      return {
        pass: false,
        message: "Port 3000 not found in any Dockerfile",
        hint: "Add EXPOSE 3000 and ensure your app listens on port 3000.",
      };
    },
  },
  {
    name: "/healthz endpoint",
    run: (cwd) => {
      const scan = scanProject(cwd);
      if (scan.generic.hasHealthEndpoint) {
        return { pass: true, message: "Health endpoint detected" };
      }
      if (fileContains(cwd, "Dockerfile", "healthz") || fileContains(cwd, "Dockerfile.web", "healthz")) {
        return { pass: true, message: "Health check found in Dockerfile HEALTHCHECK" };
      }
      const srcFiles = [
        "src/server/standalone.ts",
        "src/app/healthz/route.ts",
        "src/pages/api/healthz.ts",
      ];
      for (const f of srcFiles) {
        if (fileExists(cwd, f) && fileContains(cwd, f, "healthz")) {
          return { pass: true, message: `Health endpoint in ${f}` };
        }
      }
      return {
        pass: false,
        message: "No /healthz endpoint detected",
        hint: "Implement GET /healthz returning HTTP 200. This is required for liveness probes.",
      };
    },
  },
  {
    name: "Database migration in entrypoint",
    run: (cwd) => {
      if (!fileExists(cwd, "prisma/schema.prisma") && !fileExists(cwd, "drizzle.config.ts")) {
        return { pass: true, message: "No database ORM detected — skipped" };
      }
      if (fileContains(cwd, "docker-entrypoint.sh", "migrate")) {
        return { pass: true, message: "Migration found in docker-entrypoint.sh" };
      }
      if (fileContains(cwd, "Dockerfile", "migrate deploy")) {
        return { pass: true, message: "Migration found in Dockerfile" };
      }
      return {
        pass: false,
        message: "Database migration not found in entrypoint",
        hint: "Add `npx prisma migrate deploy` (or equivalent) to docker-entrypoint.sh.",
      };
    },
  },
  {
    name: "GitHub Actions workflow",
    run: (cwd) => {
      const has = fileExists(cwd, ".github/workflows/deploy-velobase.yml");
      return {
        pass: has,
        message: has
          ? "deploy-velobase.yml found"
          : "No deploy-velobase.yml workflow",
        hint: "Run `velobase-cloud init` to generate the workflow file.",
      };
    },
  },
  {
    name: "No hardcoded secrets",
    run: (cwd) => {
      const suspicious = ["DATABASE_URL=", "REDIS_URL=", "AWS_SECRET", "PRIVATE_KEY"];
      const files = [".env", ".env.local", ".env.production"];
      for (const f of files) {
        if (fileExists(cwd, f)) {
          return {
            pass: false,
            message: `${f} found — may contain secrets`,
            hint: `Ensure ${f} is in .gitignore and use \`velobase-cloud env set\` for cloud config.`,
          };
        }
      }
      return { pass: true, message: "No .env files detected in project root" };
    },
  },
  {
    name: "Environment validation",
    run: (cwd) => {
      if (!fileExists(cwd, "src/env.js") && !fileExists(cwd, "src/env.ts")) {
        return { pass: true, message: "No env validation file — skipped (non-Harness)" };
      }
      if (
        fileContains(cwd, "src/env.js", "SKIP_ENV_VALIDATION") ||
        fileContains(cwd, "src/env.ts", "SKIP_ENV_VALIDATION")
      ) {
        return { pass: true, message: "SKIP_ENV_VALIDATION supported in env config" };
      }
      return {
        pass: false,
        message: "src/env.js missing SKIP_ENV_VALIDATION support",
        hint: "The Dockerfile build stage needs SKIP_ENV_VALIDATION=1 to bypass runtime env checks.",
      };
    },
  },
];

export const doctorCommand = new Command("doctor")
  .description("Check project readiness for Velobase Cloud deployment")
  .action(() => {
    const cwd = process.cwd();
    heading("Deployment Readiness Check");

    let passed = 0;
    let failed = 0;
    let warned = 0;

    for (const check of CHECKS) {
      const result = check.run(cwd);
      if (result.pass) {
        success(result.message);
        passed++;
      } else {
        fail(result.message);
        if (result.hint) dim(result.hint);
        failed++;
      }
    }

    console.log();
    const total = passed + failed;
    if (failed === 0) {
      console.log(
        chalk.green.bold(`  All ${total} checks passed — ready to deploy!`),
      );
    } else {
      console.log(
        chalk.yellow(
          `  ${passed}/${total} passed, ${failed} failed`,
        ),
      );
      info("Fix the issues above, then run `velobase-cloud doctor` again.");
    }
  });
