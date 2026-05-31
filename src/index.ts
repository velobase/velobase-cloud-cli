import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { whoamiCommand } from "./commands/whoami.js";
import { githubCommand } from "./commands/github.js";
import { initCommand } from "./commands/init.js";
import { adaptCommand } from "./commands/adapt.js";
import { statusCommand } from "./commands/status.js";
import { logsCommand } from "./commands/logs.js";
import { doctorCommand } from "./commands/doctor.js";
import { deployCommand } from "./commands/deploy.js";
import { envCommand } from "./commands/env.js";
import { configCommand } from "./commands/config.js";
import { billingCommand } from "./commands/billing.js";

const program = new Command();

program
  .name("velobase-cloud")
  .description("Adapt, deploy, and observe your projects on Velobase Cloud")
  .version(__CLI_VERSION__);

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);
program.addCommand(githubCommand);
program.addCommand(initCommand);
program.addCommand(adaptCommand);
program.addCommand(statusCommand);
program.addCommand(logsCommand);
program.addCommand(doctorCommand);
program.addCommand(deployCommand);
program.addCommand(envCommand);
program.addCommand(configCommand);
program.addCommand(billingCommand);

program.parse();
