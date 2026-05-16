# @velobaseai/cloud-cli

Adapt, deploy, and observe your projects on [Velobase Cloud](https://velobase.cloud).

## Install

```bash
npm install -g @velobaseai/cloud-cli
```

## Quick Start

```bash
# Sign in to Velobase Cloud
velobase-cloud login

# Connect your GitHub account
velobase-cloud github connect

# Initialize your project
cd your-project
velobase-cloud init

# Generate AI adaptation context
velobase-cloud adapt

# Check deployment readiness
velobase-cloud doctor

# Push to deploy
git push origin main
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Sign in via browser (Device Auth Flow) |
| `logout` | Clear local credentials |
| `whoami` | Show current user |
| `github connect` | Connect your GitHub account |
| `github status` | Show GitHub connection status |
| `init` | Initialize project for Cloud deployment |
| `adapt` | Generate AI adaptation context (.velobase/) |
| `doctor` | Check deployment readiness (7 checks) |
| `status` | Show project and runtime status |
| `deploy trigger` | Trigger deployment via GitHub Actions |
| `deploy runs` | List recent workflow runs |
| `deploy rollback <id>` | Rollback to a previous deployment |
| `logs pods` | List running pods |
| `logs pod <name>` | Show pod logs |
| `logs deploy [id]` | Show deployment logs |
| `env list` | List environment variables |
| `env set <key> <value>` | Set an environment variable |
| `env delete <key>` | Delete an environment variable |
| `config set <key> <value>` | Set CLI configuration |
| `config show` | Show current configuration |

## How It Works

1. `velobase-cloud init` scans your project, detects the tech stack (Velobase Harness or generic), creates a Cloud project with all infrastructure (PostgreSQL, Redis, K8s, domain), writes the GitHub Actions deploy workflow, and configures secrets.

2. `velobase-cloud adapt` generates `.velobase/ai-prompt.md` with deployment constraints and adaptation instructions. Feed this to your IDE AI to make your project Cloud-ready.

3. `velobase-cloud doctor` runs 7 local checks: Dockerfile, port 3000, /healthz, DB migration, workflow, secrets, env validation.

4. After `git push`, GitHub Actions builds the Docker image, pushes to ACR, and triggers deployment via the Velobase Deploy API.

## Configuration

CLI config is stored in `~/.velobase-cloud/`:

- `credentials.json` — CLI access token
- `config.json` — API base URL and other settings

Project config is stored in `.velobase/`:

- `config.json` — Project binding (project ID, subdomain)
- `ai-prompt.md` — AI adaptation instructions

## License

MIT
