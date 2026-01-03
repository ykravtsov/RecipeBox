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

The infrastructure uses environment variables for configuration:

- `GITHUB_REPOSITORY_URL`: Your GitHub repository URL (automatically set in CI/CD)
- `POSTGRES_PASSWORD`: PostgreSQL administrator password (set via GitHub Secrets)

## Security Note

The PostgreSQL password is read from the `POSTGRES_PASSWORD` environment variable. Make sure to set this as a GitHub Secret in your repository settings.
