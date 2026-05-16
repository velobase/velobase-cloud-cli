import chalk from "chalk";

export function success(msg: string) {
  console.log(chalk.green("  ✔ ") + msg);
}

export function fail(msg: string) {
  console.log(chalk.red("  ✖ ") + msg);
}

export function warn(msg: string) {
  console.log(chalk.yellow("  ⚠ ") + msg);
}

export function info(msg: string) {
  console.log(chalk.blue("  ℹ ") + msg);
}

export function dim(msg: string) {
  console.log(chalk.dim("    " + msg));
}

export function heading(msg: string) {
  console.log();
  console.log(chalk.bold("  " + msg));
  console.log();
}

export function label(key: string, value: string) {
  console.log(`  ${chalk.dim(key + ":")} ${value}`);
}

export function stateColor(state: string): string {
  switch (state) {
    case "green":
    case "SUCCEEDED":
    case "ACTIVE":
      return chalk.green(state);
    case "yellow":
    case "DEPLOYING":
    case "QUEUED":
    case "PROVISIONING":
      return chalk.yellow(state);
    case "red":
    case "FAILED":
      return chalk.red(state);
    default:
      return chalk.dim(state);
  }
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + "…";
}
