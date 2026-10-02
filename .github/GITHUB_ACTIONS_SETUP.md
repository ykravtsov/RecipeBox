# GitHub Actions Infrastructure Deployment Guide

## Overview

This guide explains how to set up and use the GitHub Actions workflow for deploying RecipeBox infrastructure to Azure using CDKTF and Azure CLI.

## Prerequisites

1. **Azure Subscription** - You need an active Azure subscription
2. **GitHub Repository** - Repository with GitHub Actions enabled
3. **Required Secrets** - Configure these in GitHub Settings

## Step 1: Set Up GitHub Secrets

### 1.1 Generate AZURE_CREDENTIALS

This secret contains credentials for a service principal that will deploy your infrastructure.

```bash
# Login to Azure
az login

# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Subscription ID: $SUBSCRIPTION_ID"

# Create a service principal with Contributor role
az ad sp create-for-rbac \
  --name "RecipeBoxGitHub" \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID
```

This will output JSON like:
```json
{
  "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "RecipeBoxGitHub",
  "password": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenant": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Convert it to the required format and add as GitHub Secret:

```json
{
  "subscriptionId": "YOUR-SUBSCRIPTION-ID",
  "clientId": "appId-from-above",
  "clientSecret": "password-from-above",
  "tenantId": "tenant-from-above"
}
```

**How to add to GitHub:**
1. Go to your repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `AZURE_CREDENTIALS`
5. Paste the entire JSON (can be on one line)
6. Click "Add secret"

### 1.2 Add POSTGRES_PASSWORD Secret

Create a strong password that meets these requirements:
- Minimum 8 characters
- Must include uppercase letter (A-Z)
- Must include lowercase letter (a-z)
- Must include number (0-9)
- Must include special character (!@#$%^&*-_.+=\|)

Example: set with `gh secret set POSTGRES_PASSWORD`

**How to add to GitHub:**
1. Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `POSTGRES_PASSWORD`
4. Paste your strong password
5. Click "Add secret"

## Step 2: Verify Workflow Setup

The workflow file is located at `.github/workflows/deploy.yml` and includes:

- **Automatic deployment** on push to `main` branch (dev environment)
- **Manual deployment** via `workflow_dispatch` (select environment and action)
- **Plan, apply, or destroy** options
- **Validation** job to check TypeScript syntax

## Step 3: Deploy Infrastructure

### Option A: Automatic Deployment (Push to Main)

1. Make changes to infrastructure code in the `infra/` directory
2. Commit and push to `main` branch
3. GitHub Actions will automatically:
   - Validate the code
   - Plan the infrastructure
   - Deploy to dev environment

### Option B: Manual Deployment

1. Go to your GitHub repository
2. Click "Actions" tab
3. Select "Deploy Infrastructure" workflow
4. Click "Run workflow"
5. Select:
   - **Environment**: dev/staging/prod
   - **Action**: plan/apply/destroy
6. Click "Run workflow"

The workflow will:
- Plan: Show what will change (no actual deployment)
- Apply: Deploy the infrastructure
- Destroy: Tear down all resources

## Step 4: Monitor Deployment

### During Workflow Execution

1. Click on the workflow run
2. Watch the logs in real-time
3. Each step shows:
   - ✅ Steps that passed
   - ❌ Steps that failed
   - ⏳ Steps in progress

### After Workflow Completion

1. View deployment outputs in the workflow summary
2. Get Azure resource information:
   ```bash
   # Get resource group
   az group list --query "[?tags.ManagedBy=='Terraform']" -o table
   
   # Get AKS cluster
   az aks list --resource-group rg-recipebox-dev --query "[].{name:name, fqdn:fqdn}" -o table
   
   # Get ACR (Container Registry)
   az acr list --resource-group rg-recipebox-dev --query "[].{name:name, loginServer:loginServer}" -o table
   
   # Get PostgreSQL server
   az postgres flexible-server list --resource-group rg-recipebox-dev --query "[].{name:name, fullyQualifiedDomainName:fullyQualifiedDomainName}" -o table
   ```

## Step 5: Access Deployed Resources

### Get AKS Credentials

```bash
az aks get-credentials \
  --resource-group rg-recipebox-dev \
  --name recipebox-aks-dev
```

### Access ArgoCD

```bash
# Get ArgoCD service
kubectl get svc -n argocd

# Get ArgoCD admin password
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath="{.data.password}" | base64 -d
```

### Access PostgreSQL

```bash
# Get PostgreSQL connection details
az postgres flexible-server list \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, host:fullyQualifiedDomainName, user:administratorLogin}" -o table

# Connect to PostgreSQL (after configuring firewall)
psql -h <host> -U pgadmin -d recipebox
```

### Access Container Registry

```bash
# Get ACR login credentials
az acr credential show \
  --name recipeboxacrodev \
  --resource-group rg-recipebox-dev \
  --query "{username:username, password:passwords[0].value}" -o table

# Login to ACR
az acr login --name recipeboxacrodev
```

## Step 6: Troubleshooting

### Workflow Fails with "AZURE_CREDENTIALS not set"

**Solution**: 
1. Verify secret exists in Settings → Secrets and variables → Actions
2. Make sure secret name is exactly `AZURE_CREDENTIALS`
3. Verify JSON format is correct (no line breaks inside JSON)

### Workflow Fails with "POSTGRES_PASSWORD not set"

**Solution**: 
1. Verify `POSTGRES_PASSWORD` secret exists
2. Ensure password meets complexity requirements
3. Check for special characters that might need escaping

### CDKTF Synth Fails

**Solution**:
1. Verify `.env` file format (if deploying locally)
2. Check environment variables are correctly set:
   ```bash
   echo $ENVIRONMENT
   echo $POSTGRES_PASSWORD
   echo $GITHUB_REPOSITORY_URL
   echo $AZURE_CREDENTIALS | jq .
   ```
3. Validate TypeScript syntax:
   ```bash
   cd infra
   npm run build
   ```

### Azure Authentication Fails

**Solution**:
1. Verify service principal has Contributor role:
   ```bash
   az role assignment list --assignee <clientId> -o table
   ```
2. Check credentials aren't expired:
   ```bash
   az ad sp credential list --id <clientId> --query "[].endDateTime"
   ```
3. Regenerate credentials if needed:
   ```bash
   az ad sp credential reset --name RecipeBoxGitHub
   ```

## Step 7: Local Development (Optional)

To test infrastructure changes locally before pushing:

```bash
cd infra

# Set environment variables
export ENVIRONMENT=dev
export POSTGRES_PASSWORD="MyPassword@123"
export GITHUB_REPOSITORY_URL="https://github.com/your-org/RecipeBox"
export AZURE_CREDENTIALS='{"subscriptionId":"...","clientId":"...","clientSecret":"...","tenantId":"..."}'

# Install dependencies
npm install

# Build TypeScript
npm run build

# Generate Terraform
npx cdktf synth

# Plan deployment
npx cdktf plan recipebox-infra

# Deploy (optional)
npx cdktf deploy recipebox-infra

# Get outputs
npx cdktf output recipebox-infra
```

## Step 8: Cost Management

Monitor Azure costs for the dev environment:

```bash
# Get resource group summary
az group show \
  --name rg-recipebox-dev \
  --query "{name:name, location:location, tags:tags}" -o json

# List all resources
az resource list \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, type:type, location:location}" -o table

# Destroy resources when not needed (manual workflow dispatch)
# Or clear everything with:
az group delete --name rg-recipebox-dev --yes
```

## Next Steps

1. ✅ Configure GitHub Secrets
2. ✅ Test workflow with manual dispatch
3. ✅ Deploy to dev environment
4. ✅ Set up ArgoCD applications for automated deployments
5. ✅ Configure staging/prod environments
6. ✅ Set up monitoring and alerts

## Additional Resources

- [CDKTF Documentation](https://developer.hashicorp.com/terraform/cdktf)
- [Azure Terraform Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure CLI Reference](https://learn.microsoft.com/cli/azure/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)

