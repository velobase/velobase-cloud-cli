import fs from "node:fs";
import path from "node:path";

export type TechStack =
  | "nextjs"
  | "express"
  | "fastify"
  | "hono"
  | "django"
  | "fastapi"
  | "flask"
  | "go"
  | "spring"
  | "unknown";

export interface GenericDetectionResult {
  stack: TechStack;
  language: "node" | "python" | "go" | "java" | "unknown";
  hasDockerfile: boolean;
  hasPrisma: boolean;
  hasHealthEndpoint: boolean;
}

function fileExists(cwd: string, rel: string): boolean {
  return fs.existsSync(path.join(cwd, rel));
}

function readJson(cwd: string, rel: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, rel), "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasDep(pkg: Record<string, unknown> | null, name: string): boolean {
  if (!pkg) return false;
  const deps = pkg.dependencies as Record<string, string> | undefined;
  const devDeps = pkg.devDependencies as Record<string, string> | undefined;
  return !!(deps?.[name] || devDeps?.[name]);
}

function detectNodeStack(cwd: string): TechStack {
  const pkg = readJson(cwd, "package.json");
  if (!pkg) return "unknown";
  if (hasDep(pkg, "next")) return "nextjs";
  if (hasDep(pkg, "hono")) return "hono";
  if (hasDep(pkg, "fastify")) return "fastify";
  if (hasDep(pkg, "express")) return "express";
  return "unknown";
}

function detectHealthEndpoint(cwd: string): boolean {
  const paths = [
    "src/app/healthz/route.ts",
    "src/app/healthz/route.js",
    "src/pages/api/healthz.ts",
    "src/pages/api/healthz.js",
    "app/healthz/route.ts",
  ];
  return paths.some((p) => fileExists(cwd, p));
}

export function detectGenericProject(cwd?: string): GenericDetectionResult {
  const dir = cwd ?? process.cwd();

  const hasDockerfile = fileExists(dir, "Dockerfile");
  const hasPrisma = fileExists(dir, "prisma/schema.prisma");
  const hasHealthEndpoint = detectHealthEndpoint(dir);

  if (fileExists(dir, "package.json")) {
    return {
      stack: detectNodeStack(dir),
      language: "node",
      hasDockerfile,
      hasPrisma,
      hasHealthEndpoint,
    };
  }

  if (fileExists(dir, "requirements.txt") || fileExists(dir, "pyproject.toml")) {
    let stack: TechStack = "unknown";
    try {
      const reqs = fs.readFileSync(
        path.join(dir, fileExists(dir, "requirements.txt") ? "requirements.txt" : "pyproject.toml"),
        "utf-8",
      );
      if (reqs.includes("django") || reqs.includes("Django")) stack = "django";
      else if (reqs.includes("fastapi") || reqs.includes("FastAPI")) stack = "fastapi";
      else if (reqs.includes("flask") || reqs.includes("Flask")) stack = "flask";
    } catch { /* ignore */ }
    return { stack, language: "python", hasDockerfile, hasPrisma, hasHealthEndpoint };
  }

  if (fileExists(dir, "go.mod")) {
    return { stack: "go", language: "go", hasDockerfile, hasPrisma: false, hasHealthEndpoint: false };
  }

  if (fileExists(dir, "pom.xml") || fileExists(dir, "build.gradle") || fileExists(dir, "build.gradle.kts")) {
    return { stack: "spring", language: "java", hasDockerfile, hasPrisma: false, hasHealthEndpoint: false };
  }

  return { stack: "unknown", language: "unknown", hasDockerfile, hasPrisma, hasHealthEndpoint };
}
