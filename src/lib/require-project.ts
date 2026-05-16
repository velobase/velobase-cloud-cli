import { getToken } from "../config/store.js";
import { getProjectConfig, type ProjectConfig } from "../config/project.js";
import { fail, info } from "./format.js";

export function requireProject(): ProjectConfig {
  if (!getToken()) {
    fail("Not logged in.");
    info("Run `velobase-cloud login` first.");
    return process.exit(1) as never;
  }

  const config = getProjectConfig();
  if (!config) {
    fail("Project not initialized.");
    info("Run `velobase-cloud init` first.");
    return process.exit(1) as never;
  }

  return config;
}
