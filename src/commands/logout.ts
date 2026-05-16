import { Command } from "commander";
import { clearCredentials, getToken } from "../config/store.js";
import { success, info } from "../lib/format.js";

export const logoutCommand = new Command("logout")
  .description("Sign out of Velobase Cloud")
  .action(() => {
    if (!getToken()) {
      info("Not logged in.");
      return;
    }
    clearCredentials();
    success("Logged out.");
  });
