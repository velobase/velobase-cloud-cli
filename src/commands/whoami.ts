import { Command } from "commander";
import { api } from "../api/client.js";
import type { WhoamiResponse } from "../api/types.js";
import { getToken } from "../config/store.js";
import { label, info, heading } from "../lib/format.js";
import { handleError } from "../lib/error-handler.js";

export const whoamiCommand = new Command("whoami")
  .description("Show the currently logged-in user")
  .action(async () => {
    if (!getToken()) {
      info("Not logged in. Run `velobase-cloud login` first.");
      return;
    }
    try {
      const user = await api.get<WhoamiResponse>("/api/cli/auth/whoami");
      heading("Current User");
      label("Email", user.email);
      if (user.name) label("Name", user.name);
      label("User ID", user.userId);
    } catch (err) {
      handleError(err);
    }
  });
