import fs from "node:fs";
import path from "node:path";
import {
  CONFIG_DIR,
  CREDENTIALS_FILE,
  CONFIG_FILE,
  DEFAULT_API_BASE,
} from "./constants.js";

export interface Credentials {
  token: string;
  expiresAt: string;
}

export interface GlobalConfig {
  apiBase: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJson<T>(filepath: string): T | null {
  try {
    const raw = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(filepath: string, data: unknown) {
  ensureDir(path.dirname(filepath));
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function getCredentials(): Credentials | null {
  return readJson<Credentials>(CREDENTIALS_FILE);
}

export function saveCredentials(creds: Credentials) {
  writeJson(CREDENTIALS_FILE, creds);
}

export function clearCredentials() {
  try {
    fs.unlinkSync(CREDENTIALS_FILE);
  } catch {
    // ignore if file doesn't exist
  }
}

export function getToken(): string | null {
  if (process.env.VELOBASE_CLOUD_TOKEN) {
    return process.env.VELOBASE_CLOUD_TOKEN;
  }
  return getCredentials()?.token ?? null;
}

export function getGlobalConfig(): GlobalConfig {
  const saved = readJson<Partial<GlobalConfig>>(CONFIG_FILE);
  return {
    apiBase: process.env.VELOBASE_CLOUD_API_BASE ?? saved?.apiBase ?? DEFAULT_API_BASE,
  };
}

export function saveGlobalConfig(config: Partial<GlobalConfig>) {
  const current = getGlobalConfig();
  writeJson(CONFIG_FILE, { ...current, ...config });
}
