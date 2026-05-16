import fs from "node:fs";
import path from "node:path";

interface Signal {
  label: string;
  weight: number;
  check: (cwd: string) => boolean;
}

function fileExists(cwd: string, rel: string): boolean {
  return fs.existsSync(path.join(cwd, rel));
}

function fileContains(cwd: string, rel: string, needle: string): boolean {
  try {
    const content = fs.readFileSync(path.join(cwd, rel), "utf-8");
    return content.includes(needle);
  } catch {
    return false;
  }
}

const SIGNALS: Signal[] = [
  {
    label: "AGENTS.md",
    weight: 2,
    check: (cwd) => fileExists(cwd, "AGENTS.md"),
  },
  {
    label: "src/server/standalone.ts",
    weight: 2,
    check: (cwd) => fileExists(cwd, "src/server/standalone.ts"),
  },
  {
    label: "docker-entrypoint.sh with SERVICE_MODE",
    weight: 2,
    check: (cwd) => fileContains(cwd, "docker-entrypoint.sh", "SERVICE_MODE"),
  },
  {
    label: "src/env.js with @t3-oss/env-nextjs",
    weight: 1,
    check: (cwd) => fileContains(cwd, "src/env.js", "@t3-oss/env-nextjs"),
  },
  {
    label: "package.json with ct3aMetadata",
    weight: 1,
    check: (cwd) => fileContains(cwd, "package.json", "ct3aMetadata"),
  },
  {
    label: "src/workers/registry.ts",
    weight: 1,
    check: (cwd) => fileExists(cwd, "src/workers/registry.ts"),
  },
  {
    label: "src/modules/ directory",
    weight: 1,
    check: (cwd) => {
      try {
        return fs.statSync(path.join(cwd, "src/modules")).isDirectory();
      } catch {
        return false;
      }
    },
  },
  {
    label: "deploy/base/kustomization.yaml",
    weight: 1,
    check: (cwd) => fileExists(cwd, "deploy/base/kustomization.yaml"),
  },
  {
    label: "Dockerfile with SERVICE_MODE",
    weight: 1,
    check: (cwd) => fileContains(cwd, "Dockerfile", "SERVICE_MODE"),
  },
];

const THRESHOLD = 3;

export interface HarnessDetectionResult {
  isHarness: boolean;
  score: number;
  matched: string[];
}

export function detectHarness(cwd?: string): HarnessDetectionResult {
  const dir = cwd ?? process.cwd();
  const matched: string[] = [];
  let score = 0;

  for (const signal of SIGNALS) {
    if (signal.check(dir)) {
      score += signal.weight;
      matched.push(signal.label);
    }
  }

  return { isHarness: score >= THRESHOLD, score, matched };
}

export interface HarnessServiceMode {
  hasMultiDockerfile: boolean;
  dockerfiles: string[];
}

export function detectHarnessServiceMode(cwd?: string): HarnessServiceMode {
  const dir = cwd ?? process.cwd();
  const candidates = [
    "Dockerfile",
    "Dockerfile.web",
    "Dockerfile.api",
    "Dockerfile.worker",
  ];
  const found = candidates.filter((f) => fileExists(dir, f));
  const hasMulti =
    found.includes("Dockerfile.web") &&
    found.includes("Dockerfile.api");

  return { hasMultiDockerfile: hasMulti, dockerfiles: found };
}
