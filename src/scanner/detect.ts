import { detectHarness, type HarnessDetectionResult } from "./harness.js";
import { detectGenericProject, type GenericDetectionResult } from "./generic.js";

export type ProjectType = "harness" | "generic";

export interface ScanResult {
  type: ProjectType;
  harness: HarnessDetectionResult;
  generic: GenericDetectionResult;
}

export function scanProject(cwd?: string): ScanResult {
  const harness = detectHarness(cwd);
  const generic = detectGenericProject(cwd);

  return {
    type: harness.isHarness ? "harness" : "generic",
    harness,
    generic,
  };
}
