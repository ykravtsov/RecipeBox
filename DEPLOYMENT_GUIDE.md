# RecipeBox Deployment Guide - Getting Started with GitHub & Azure

This guide walks you through deploying the RecipeBox infrastructure to Azure using GitHub Actions and Azure CLI.

## 🎯 Quick Start (5 minutes)

If you already have Azure credentials and GitHub secrets configured:

```bash
# 1. Update deployment.yml in GitHub
cat .github/workflows/deploy.yml

# 2. Push to main branch
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deployment workflow"
git push origin main

# 3. Watch deployment in GitHub Actions
# Go to: https://github.com/your-org/RecipeBox/actions/workflows/deploy.yml

# 4. Monitor infrastructure creation
az group list --query "[?tags.Environment=='dev']" -o table
```

---

## 📋 Full Setup (30 minutes)

### Step 1: Install Required Tools

```bash
# On macOS
brew install az-cli
brew install terraform

# Verify installation
az --version
terraform --version

# Install Node.js (for CDKTF locally)
brew install node@18
npm --version
```

### Step 2: Create Azure Service Principal

```bash
# Login to Azure
az login

# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Creating service principal for subscription: $SUBSCRIPTION_ID"

# Create service principal
SERVICE_PRINCIPAL=$(az ad sp create-for-rbac \
  --name "RecipeBoxGitHub" \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID \
  --query "{subscriptionId:serviceClient, clientId:appId, clientSecret:password, tenantId:tenant}"  \
  -o json)

echo "Service Principal created:"
echo "$SERVICE_PRINCIPAL" | jq .

# Save for later use
echo "$SERVICE_PRINCIPAL" > /tmp/sp.json
```

### Step 3: Configure GitHub Secrets

```bash
# Upload AZURE_CREDENTIALS secret
# You can use gh CLI (recommended) or GitHub web interface

# Using GitHub CLI:
gh secret set AZURE_CREDENTIALS --body "$(cat /tmp/sp.json)"

# Add POSTGRES_PASSWORD secret
gh secret set POSTGRES_PASSWORD --body "MyRecipeBox@2024!"

# Verify secrets are set
gh secret list
```

### Step 4: Deploy from GitHub Actions

#### Option A: Automatic Deployment (Push to Main)

```bash
# Push infrastructure code changes
git add infra/
git commit -m "feat: update infrastructure configuration"
git push origin main

# GitHub Actions will automatically:
# 1. Validate TypeScript
# 2. Plan infrastructure changes
# 3. Deploy to dev environment

# Watch progress at:
# https://github.com/your-org/RecipeBox/actions/workflows/deploy.yml
```

#### Option B: Manual Deployment (Web Interface)

1. Go to GitHub Actions tab: https://github.com/your-org/RecipeBox/actions
2. Select "Deploy Infrastructure" workflow
3. Click "Run workflow"
4. Select environment (dev/staging/prod) and action (plan/apply/destroy)
5. Click green "Run workflow" button
6. Monitor the logs in real-time

### Step 5: Access Your Deployment

```bash
# Get AKS credentials
az aks get-credentials \
  --resource-group rg-recipebox-dev \
  --name recipebox-aks-dev

# Verify cluster access
kubectl cluster-info
kubectl get nodes

# Access ArgoCD
kubectl get svc -n argocd
kubectl port-forward -n argocd svc/argocd-server 8080:443

# Get ArgoCD admin password
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath="{.data.password}" | base64 -d
# Open https://localhost:8080 and login with admin user

# Get PostgreSQL connection info
az postgres flexible-server show \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  --query "fullyQualifiedDomainName" -o tsv
```

---

## 🔄 Typical Workflows

### Deploying Infrastructure Changes

```bash
# 1. Make changes to infra/main.ts
vim infra/main.ts

# 2. Test locally (optional)
cd infra
export ENVIRONMENT=dev
export POSTGRES_PASSWORD="TestPass@123"
export GITHUB_REPOSITORY_URL="https://github.com/your-org/RecipeBox"
export AZURE_CREDENTIALS="$(gh secret get AZURE_CREDENTIALS)"

npm install
npm run build
npx cdktf plan recipebox-infra  # Review changes
npx cdktf deploy recipebox-infra  # Deploy locally (optional)

# 3. Commit and push
cd ..
git add infra/
git commit -m "feat: update infrastructure"
git push origin main

# 4. Monitor deployment in GitHub Actions
```

### Scaling the Cluster

```bash
# Option 1: Via Azure CLI
az aks nodepool scale \
  --resource-group rg-recipebox-dev \
  --cluster-name recipebox-aks-dev \
  --name default \
  --node-count 3

# Option 2: Via infrastructure code
# Edit infra/main.ts, change aksNodeCount in dev config
# Commit and push to trigger automatic deployment
```

### Managing Secrets

```bash
# Store new secrets in Key Vault
az keyvault secret set \
  --vault-name recipebox-kv-dev \
  --name my-api-key \
  --value "secret-value"

# Retrieve secrets
az keyvault secret show \
  --vault-name recipebox-kv-dev \
  --name my-api-key \
  --query "value" -o tsv

# Update GitHub Actions secret
gh secret set MY_SECRET --body "new-secret-value"
```

### Managing Containers

```bash
# Login to Azure Container Registry
az acr login --name recipeboxacrdev

# Build and push image manually
docker build -t recipeboxacrdev.azurecr.io/recipebox-api:v1.0 ./rust-backend
docker push recipeboxacrdev.azurecr.io/recipebox-api:v1.0

# View pushed containers
az acr repository list --name recipeboxacrdev
az acr repository show-tags --name recipeboxacrdev --repository recipebox-api
```

### Database Management

```bash
# Connect to PostgreSQL
psql -h recipebox-pg-dev.postgres.database.azure.com \
  -U pgadmin \
  -d recipebox

# Create backup
az postgres flexible-server backup create \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev

# List backups
az postgres flexible-server backup list \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev

# Restore from backup (creates new server)
az postgres flexible-server restore \
  --name recipebox-pg-restored \
  --resource-group rg-recipebox-dev \
  --source-server recipebox-pg-dev
```

---

## 🆘 Troubleshooting

### GitHub Actions Fails with "Secrets not found"

**Diagnosis**:
```bash
# Check if secrets are set
gh secret list

# Check secret value (last 4 chars only)
gh secret view AZURE_CREDENTIALS
```

**Solution**:
1. Go to Repository Settings → Secrets and variables → Actions
2. Add/update `AZURE_CREDENTIALS` secret
3. Rerun workflow

### Infrastructure Deployment Hangs

**Diagnosis**:
```bash
# Check AKS cluster creation status
az aks show \
  --resource-group rg-recipebox-dev \
  --name recipebox-aks-dev \
  --query "powerState.code" -o tsv

# Check provisioning state
az aks show \
  --resource-group rg-recipebox-dev \
  --name recipebox-aks-dev \
  --query "provisioningState" -o tsv
```

**Solution**:
- AKS creation can take 10-20 minutes - be patient
- Check GitHub Actions logs for specific errors
- Manual rollback if needed:
  ```bash
  az group delete --name rg-recipebox-dev --yes
  ```

### Azure CLI Commands Fail with "Not authenticated"

**Solution**:
```bash
# Login again
az login

# Or with service principal
az login --service-principal \
  -u $AZURE_CLIENT_ID \
  -p $AZURE_CLIENT_SECRET \
  --tenant $AZURE_TENANT_ID

# Check current account
az account show
```

### PostgreSQL Connection Refused

**Diagnosis**:
```bash
# Check firewall rules
az postgres flexible-server firewall-rule list \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev

# Check connection string
az postgres flexible-server show \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  --query "fullyQualifiedDomainName" -o tsv
```

**Solution**:
Add firewall rules:
```bash
# Allow Azure services
az postgres flexible-server firewall-rule create \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Allow your IP
MYIP=$(dig +short myip.opendns.com @resolver1.opendns.com)
az postgres flexible-server firewall-rule create \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  --rule-name AllowMyIP \
  --start-ip-address $MYIP \
  --end-ip-address $MYIP
```

---

## 📊 Monitoring & Logs

### View GitHub Actions Logs

```bash
# List recent runs
gh run list --workflow deploy.yml

# View run details
gh run view <run-id> --log

# Cancel a run
gh run cancel <run-id>

# Watch logs in real-time
gh run watch <run-id>
```

### View Azure Resources

```bash
# Monitor resource group
az group show --name rg-recipebox-dev -o json

# Check recent activities
az monitor activity-log list \
  --resource-group rg-recipebox-dev \
  --max-events 20 \
  -o table

# Get AKS cluster events
kubectl get events -n kube-system --sort-by='.lastTimestamp'

# View pod logs
kubectl logs -n argocd deployment/argocd-server -c argocd-server --tail=50
```

### Cost Monitoring

```bash
# Get all resources with resource group
az resource list \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, type:type, location:location, id:id}" -o table

# Estimate monthly costs (rough)
# Edit the generated terraform plan and check resource SKUs
# Or use Azure Cost Management console

# Clean up unused resources
az resource list \
  --resource-group rg-recipebox-dev \
  --query "[?tags.Environment=='dev']" -o table
```

---

## 🚀 Advanced Topics

### Multiple Environments (Staging & Prod)

```bash
# 1. Set up staging environment (manual dispatch)
# GitHub Actions UI → Run workflow → Select "staging"

# 2. Deploy prod environment
# Use same workflow, select "prod"

# 3. Verify all environments
az group list \
  --query "[?contains(name, 'recipebox')]" \
  -o table

# Switch kubectl context
kubectl config get-contexts
kubectl config use-context recipebox-aks-staging-dev
```

### Infrastructure as Code Patterns

```bash
# Store infrastructure code in Git
git init RecipeBox-Infra
cd RecipeBox-Infra

# Use CDKTf for IaC benefits:
# - Version control infrastructure
# - Code review before deployment
# - Automated deployments
# - Disaster recovery through code

# Tag releases
git tag -a v1.0 -m "Production release"
git push origin v1.0
```

### Disaster Recovery

```bash
# Full resource group backup
# List all resources to recreate
az resource list \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, type:type, id:id, location:location}" \
  > backup.json

# Database backup
az postgres flexible-server backup create \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev

# AKS backup (via Velero)
velero backup create recipebox-backup-$(date +%Y%m%d%H%M%S)
```

### Local Development

```bash
# Deploy to local Minikube for testing
minikube start

# Install CDKTF locally
npm install -g cdktf-cli

# Deploy locally
cdktf plan recipebox-infra
cdktf deploy recipebox-infra --auto-approve

# Destroy local deployment
cdktf destroy recipebox-infra --auto-approve
```

---

## 📚 Additional Resources

- [CDKTF Documentation](https://developer.hashicorp.com/terraform/cdktf)
- [Azure CLI Cheat Sheet](./AZURE_CLI_REFERENCE.md)
- [GitHub Actions Setup](./GITHUB_ACTIONS_SETUP.md)
- [Secrets Configuration](./SECRETS.md)
- [Azure Kubernetes Service](https://learn.microsoft.com/en-us/azure/aks/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)

---

## ✅ Checklist

Before you start deploying:

- [ ] Azure subscription created
- [ ] Azure CLI installed and authenticated
- [ ] GitHub CLI installed
- [ ] Service principal created with Contributor role
- [ ] `AZURE_CREDENTIALS` secret added to GitHub
- [ ] `POSTGRES_PASSWORD` secret added to GitHub
- [ ] GitHub Actions workflow reviewed
- [ ] Infrastructure code reviewed
- [ ] Monitoring set up

After deployment:

- [ ] AKS cluster is healthy
- [ ] PostgreSQL is accessible
- [ ] Container Registry has images
- [ ] ArgoCD is running
- [ ] Applications are deployed
- [ ] DNS configured (if using custom domain)
- [ ] SSL certificates configured
- [ ] Backups enabled

---

## 🎓 Learning Path

1. **Week 1**: Deploy dev environment, explore Azure portal
2. **Week 2**: Deploy staging environment, configure ArgoCD
3. **Week 3**: Set up monitoring and alerts
4. **Week 4**: Deploy prod, configure disaster recovery

---

**Questions?** Check the troubleshooting section or consult the detailed guides linked above.

