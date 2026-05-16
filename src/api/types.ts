// ── Auth ──

export interface DeviceAuthStartResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
}

export interface DeviceAuthPollResponse {
  status: "pending" | "approved" | "expired";
  token?: string;
  expiresAt?: string;
}

export interface WhoamiResponse {
  userId: string;
  email: string;
  name?: string;
}

// ── GitHub ──

export interface GitHubStatusResponse {
  connected: boolean;
  githubUsername?: string;
  scope?: string;
  hasWorkflowScope: boolean;
}

export interface GitHubAuthUrlResponse {
  authUrl: string;
}

export interface GitHubRepo {
  id: string;
  name: string;
  fullName: string;
  url: string;
  isPrivate: boolean;
  description: string | null;
  updatedAt: string;
}

// ── Projects ──

export interface ProjectSummary {
  id: string;
  tenantId: string;
  name: string;
  subdomain: string;
  status: string;
  url: string;
  githubRepoUrl: string | null;
  latestDeploy: {
    id: string;
    status: string;
    imageTag: string;
    createdAt: string;
  } | null;
}

export interface ProjectDetail extends ProjectSummary {
  customDomain: string | null;
  planTier: string | null;
  resourceUnits: number;
  maxResourceUnits: number;
  apiKeyPrefix: string | null;
}

export interface CreateProjectResponse {
  projectId: string;
  tenantId: string;
  subdomain: string;
  url: string;
  apiKey: {
    id: string;
    rawKey: string;
    keyPrefix: string;
  };
}

// ── Deployments ──

export interface DeploymentSummary {
  id: string;
  status: string;
  imageTag: string;
  triggerSource: string;
  commitSha: string | null;
  commitMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface DeploymentLogs {
  id: string;
  status: string;
  deployLogs: string | null;
  errorMessage: string | null;
}

// ── Runtime / Pods ──

export interface ServiceHealth {
  name: string;
  state: "gray" | "yellow" | "green" | "red";
  podsReady: number;
  podsDesired: number;
  cpuMillicores: number;
  memoryMB: number;
  restartCount: number;
}

export interface ProjectStatus {
  project: ProjectSummary;
  runtime: {
    state: "gray" | "yellow" | "green" | "red";
    services: ServiceHealth[];
  };
  health: {
    latest: { status: number; latencyMs: number; checkedAt: string } | null;
    successRate30d: number;
  };
}

export interface PodInfo {
  name: string;
  serviceName: string;
  phase: string;
  ready: boolean;
  restartCount: number;
}

export interface PodLogsResponse {
  podName: string;
  log: string;
}

export interface PodEventsResponse {
  events: Array<{
    reason: string;
    message: string;
    count: number;
    lastTimestamp: string;
  }>;
}

// ── Workflow ──

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  event: string;
  displayTitle: string;
  htmlUrl: string;
  createdAt: string;
}

export interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  steps: Array<{
    number: number;
    name: string;
    status: string;
    conclusion: string | null;
  }>;
}

// ── Templates ──

export interface WorkflowTemplateResponse {
  single: string;
  multi: string;
}

// ── Env ──

export interface EnvVar {
  key: string;
  description: string | null;
  scope: string;
  serviceName: string;
  updatedAt: string;
}

// ── Errors ──

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export type GitHubErrorCode =
  | "GITHUB_NOT_CONNECTED"
  | "GITHUB_TOKEN_EXPIRED"
  | "GITHUB_SCOPE_INSUFFICIENT";

export const GITHUB_ERROR_CODES = new Set<string>([
  "GITHUB_NOT_CONNECTED",
  "GITHUB_TOKEN_EXPIRED",
  "GITHUB_SCOPE_INSUFFICIENT",
]);
