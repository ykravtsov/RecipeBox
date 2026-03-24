# Infrastructure as Code

This directory contains the CDK for Terraform (CDKTF) code to provision the Azure infrastructure for the RecipeBox application.

## Infrastructure Components

- **Resource Group**: `rg-recipebox`
- **Container Registry**: `recipeboxacr`
- **PostgreSQL Flexible Server**: `recipebox-pg` with database `recipebox`
- **AKS Cluster**: `recipebox-aks` with ArgoCD installed
- **ArgoCD Applications**: Automated deployments for API and Frontend services

## Prerequisites

- Node.js 18+
- Azure CLI
- Terraform (installed via CDKTF)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Authenticate with Azure:

   ```bash
   az login
   ```

3. Deploy infrastructure:
   ```bash
   cdktf deploy
   ```

## ArgoCD Access

After deployment, get the ArgoCD server URL:

```bash
kubectl get svc -n argocd
```

Default credentials:

- Username: `admin`
- Password: Get from secret: `kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d`

## Configuration

The infrastructure uses environment variables for configuration. Copy `infra/.env.example` to `infra/.env` and fill in all values before deploying locally.

| Variable | Description | Source |
|---|---|---|
| `ENVIRONMENT` | Deployment target: `dev`, `staging`, or `prod` | Manual |
| `GITHUB_REPOSITORY_URL` | Your GitHub repository URL for ArgoCD GitOps | Manual / CI |
| `POSTGRES_PASSWORD` | PostgreSQL administrator password | GitHub Secret |
| `AZURE_CREDENTIALS` | Azure service principal JSON (subscriptionId, tenantId, clientId, clientSecret) | `az ad sp create-for-rbac` |
| `GROK_API_KEY` | xAI Grok API key | [console.x.ai](https://console.x.ai) |

## Security Note

- **Never commit `infra/.env`** — it is gitignored for this reason.
- Store all secrets as [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) for CI/CD pipelines.
- The Azure service principal should be scoped to the minimum required role (Contributor on the target resource group, not the full subscription where possible).
- Rotate the Azure `clientSecret` and `GROK_API_KEY` immediately if there is any possibility they have been exposed outside of your local machine.
