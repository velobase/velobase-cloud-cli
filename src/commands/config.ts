import { Command } from "commander";
import { getGlobalConfig, saveGlobalConfig } from "../config/store.js";
import { success, label, heading, info } from "../lib/format.js";

const setCmd = new Command("set")
  .description("Set a configuration value")
  .argument("<key>", "Config key (apiBase)")
  .argument("<value>", "Config value")
  .action((key: string, value: string) => {
    if (key === "apiBase") {
      saveGlobalConfig({ apiBase: value });
      success(`apiBase set to ${value}`);
    } else {
      info(`Unknown config key: ${key}. Available: apiBase`);
    }
  });

const showCmd = new Command("show")
  .description("Show current configuration")
  .action(() => {
    const config = getGlobalConfig();
    heading("Configuration");
    label("apiBase", config.apiBase);
  });

export const configCommand = new Command("config")
  .description("Manage CLI configuration")
  .addCommand(setCmd)
  .addCommand(showCmd);
