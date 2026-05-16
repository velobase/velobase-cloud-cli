import fs from "node:fs";
import path from "node:path";
import { PROJECT_DIR, PROJECT_CONFIG_FILE } from "./constants.js";

export interface ProjectConfig {
  projectId: string;
  tenantId: string;
  subdomain: string;
  url: string;
  projectType: "harness" | "generic";
  githubRepo: string;
  createdAt: string;
}

function projectConfigPath(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), PROJECT_DIR, PROJECT_CONFIG_FILE);
}

export function getProjectConfig(cwd?: string): ProjectConfig | null {
  const filepath = projectConfigPath(cwd);
  try {
    const raw = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(raw) as ProjectConfig;
  } catch {
    return null;
  }
}

export function saveProjectConfig(config: ProjectConfig, cwd?: string) {
  const filepath = projectConfigPath(cwd);
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function hasProjectConfig(cwd?: string): boolean {
  return fs.existsSync(projectConfigPath(cwd));
}
