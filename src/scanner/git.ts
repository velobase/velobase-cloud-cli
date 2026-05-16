import { execSync } from "node:child_process";

export interface GitRemoteInfo {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
}

export function getGitRemote(cwd?: string): GitRemoteInfo | null {
  try {
    const raw = execSync("git remote get-url origin", {
      cwd: cwd ?? process.cwd(),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    return parseGitRemoteUrl(raw);
  } catch {
    return null;
  }
}

export function parseGitRemoteUrl(url: string): GitRemoteInfo | null {
  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1]!,
      repo: sshMatch[2]!,
      fullName: `${sshMatch[1]}/${sshMatch[2]}`,
      url,
    };
  }

  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(
    /https?:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/,
  );
  if (httpsMatch) {
    return {
      owner: httpsMatch[1]!,
      repo: httpsMatch[2]!,
      fullName: `${httpsMatch[1]}/${httpsMatch[2]}`,
      url,
    };
  }

  return null;
}

export function isGitRepo(cwd?: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}
