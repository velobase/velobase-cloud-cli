import path from "node:path";
import os from "node:os";

export const CLI_NAME = "velobase-cloud";
export const DEFAULT_API_BASE = "https://api.velobase.cloud";

export const CONFIG_DIR = path.join(os.homedir(), ".velobase-cloud");
export const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");
export const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export const PROJECT_DIR = ".velobase";
export const PROJECT_CONFIG_FILE = "config.json";

export const TOKEN_PREFIX = "vbc_";
export const POLL_INTERVAL_MS = 5000;
export const DEPLOY_POLL_INTERVAL_MS = 10_000;
export const MAX_DEPLOY_WATCH_MS = 5 * 60 * 1000;
export const DEVICE_CODE_TTL_MINUTES = 10;
