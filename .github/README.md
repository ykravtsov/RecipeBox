# GitHub Actions & Infrastructure Setup

Welcome! This directory contains all the GitHub Actions workflows and documentation for deploying RecipeBox infrastructure to Azure.

## 📚 Documentation

Start here based on your role:

### 👤 For Everyone
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Essential commands and quick start (2 min read)

### 👨‍💻 For Developers
- **[SETUP_SUMMARY.md](SETUP_SUMMARY.md)** - Overview of what's been set up (5 min read)
- **[../DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)** - Complete deployment guide with examples (15 min read)

### 🔧 For DevOps/SRE Engineers
- **[GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)** - Detailed setup and troubleshooting (20 min read)
- **[AZURE_CLI_REFERENCE.md](AZURE_CLI_REFERENCE.md)** - Complete Azure CLI command reference (reference)
- **[SECRETS.md](SECRETS.md)** - Secret configuration and management (10 min read)

---

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Prerequisites
brew install azure-cli gh

# 2. Authenticate with Azure
az login

# 3. Create service principal
az ad sp create-for-rbac \
  --name RecipeBoxGitHub \
  --role Contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)

# 4. Add GitHub secrets (replace with values from step 3)
gh secret set AZURE_CREDENTIALS --body '{...}'  # JSON from az output
gh secret set POSTGRES_PASSWORD

# 5. Deploy by pushing to main
git push origin main

# 6. Monitor
gh run list --workflow deploy.yml
gh run view <run-id> --log
```

**Expected Result**: Infrastructure deploying to Azure dev environment within 20-30 minutes!

---

## 📋 What's Automated

### Infrastructure Deployment (`.github/workflows/deploy.yml`)
- ✅ Provisions Azure resources (AKS, PostgreSQL, Container Registry, etc.)
- ✅ Deploys automatically on push to main (dev environment)
- ✅ Supports manual deployment to staging/prod
- ✅ TypeScript validation
- ✅ Terraform planning before apply

### Container Image Building (`.github/workflows/build.yml`)
- ✅ Builds Rust backend Docker image
- ✅ Builds Angular frontend Docker image
- ✅ Runs tests
- ✅ Pushes to Azure Container Registry
- ✅ Triggers on code changes

---

## 📁 File Structure

```
.github/
├── workflows/
│   ├── deploy.yml              # Infrastructure deployment workflow
│   └── build.yml               # Container image building workflow
├── QUICK_REFERENCE.md          # 60-second commands & cheat sheet
├── SETUP_SUMMARY.md            # Overview of complete setup
├── GITHUB_ACTIONS_SETUP.md     # Detailed setup guide
├── AZURE_CLI_REFERENCE.md      # Azure CLI commands reference
├── SECRETS.md                  # Secret configuration guide
└── README.md                   # This file
```

---

## 🔐 Required Secrets

Add these to your GitHub repository settings:

### 1. `AZURE_CREDENTIALS`
JSON containing Azure service principal credentials:
```json
{
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**How to generate**: See [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md#step-1-set-up-github-secrets)

### 2. `POSTGRES_PASSWORD`
Strong password for PostgreSQL database:
```
Requirements:
- Minimum 8 characters
- Must include uppercase (A-Z)
- Must include lowercase (a-z)
- Must include digit (0-9)
- Must include special character (!@#$%^&*-_.+=\|)

Example: set with `gh secret set POSTGRES_PASSWORD`
```

---

## 🎯 Deployment Workflows

### Automatic (Push to Main)
```
Your Code Changes
    ↓
Push to main
    ↓
GitHub Actions Triggered
    ↓
TypeScript Build
    ↓
Infrastructure Plan
    ↓
Infrastructure Deploy (Dev)
    ↓
✅ Deployment Complete
```

### Manual (Workflow Dispatch)
```
GitHub Actions
    ↓
Run workflow manually
    ↓
Select environment (dev/staging/prod)
    ↓
Select action (plan/apply/destroy)
    ↓
Execute
    ↓
✅/❌ Result in logs
```

---

## 📊 Deployed Resources

After successful deployment, you'll have:

```
Azure Subscription
├── Resource Group: rg-recipebox-dev
│   ├── AKS Cluster (recipebox-aks-dev)
│   │   └── 1 node (configurable)
│   ├── Container Registry (recipeboxacrdev)
│   ├── PostgreSQL Server (recipebox-pg-dev)
│   ├── Storage Account (Static website)
│   ├── CDN Profile & Endpoint
│   ├── Key Vault (for secrets)
│   └── Networking & Security
├── Applications (via ArgoCD)
│   ├── recipebox-api
│   └── recipebox-frontend
```

---

## ⚙️ Configuration

### Environment Settings
Edit `infra/main.ts` to customize:
- Azure region
- Cluster node count
- VM sizes
- Database configurations
- Cost/performance trade-offs

### Environments
Supported via environment variable `ENVIRONMENT`:
- `dev` - Development (1 node, Basic SKUs)
- `staging` - Staging (2 nodes, Standard SKUs)
- `prod` - Production (3 nodes, Premium SKUs)

---

## 🔄 Common Operations

### Deploy Infrastructure Changes
```bash
vim infra/main.ts
git add infra/
git commit -m "Update infrastructure"
git push origin main
```

### Manual Deploy to Staging
1. Go to GitHub Actions tab
2. Click "Deploy Infrastructure"
3. Click "Run workflow"
4. Select environment: `staging`
5. Select action: `apply`

### Monitor Deployment
```bash
gh run list --workflow deploy.yml
gh run view <run-id> --log
```

### Access Deployed Resources
```bash
# Get AKS credentials
az aks get-credentials --resource-group rg-recipebox-dev --name recipebox-aks-dev

# Verify cluster
kubectl cluster-info

# Access ArgoCD
kubectl port-forward -n argocd svc/argocd-server 8080:443
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Workflow fails with auth error | Verify `AZURE_CREDENTIALS` secret in Settings → Secrets and variables → Actions |
| PostgreSQL won't connect | Check firewall rules: `az postgres flexible-server firewall-rule list --name recipebox-pg-dev --resource-group rg-recipebox-dev` |
| AKS deployment hangs | Normal - takes 10-20 minutes. Check status: `az aks show --name recipebox-aks-dev --resource-group rg-recipebox-dev --query provisioningState` |
| Container image push fails | Verify ACR login credentials and registry name |
| TypeScript compilation fails | Check `infra/package.json` and `npm run build` locally |

**More help?** See [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md#step-6-troubleshooting)

---

## 📈 Monitoring & Logs

### GitHub Actions Logs
```bash
# List recent deployments
gh run list --workflow deploy.yml --limit 10

# View specific deployment
gh run view <run-id>

# Stream logs
gh run watch <run-id>
```

### Azure Resources
```bash
# List resource group
az group show --name rg-recipebox-dev -o json

# List all resources
az resource list --resource-group rg-recipebox-dev -o table

# Check activity log
az monitor activity-log list --resource-group rg-recipebox-dev --max-events 20 -o table
```

### Kubernetes
```bash
kubectl get all -n argocd
kubectl logs -n argocd deployment/argocd-server
kubectl describe pod -n argocd <pod-name>
```

---

## 💰 Cost Management

Monthly cost estimates:

| Environment | Approx Cost |
|------------|------------|
| Dev | $100-150 |
| Staging | $200-250 |
| Prod | $300-400 |

**Cost optimization tips**:
- Use smaller VM sizes for dev
- Schedule resources down during off-hours
- Use spot instances (if cost-conscious)
- Monitor via Azure Cost Management

**Clean up to save money**:
```bash
# Destroy dev environment if not needed
gh workflow run deploy.yml -f environment=dev -f action=destroy

# Or manually
az group delete --name rg-recipebox-dev --yes
```

---

## 🔒 Security Best Practices

✅ **Do**:
- Store credentials in GitHub Secrets only
- Use principal of least privilege
- Rotate credentials regularly
- Enable audit logging
- Use network policies in Kubernetes

❌ **Don't**:
- Commit credentials anywhere
- Share passwords in chat/email
- Use same password for multiple services
- Disable security features

---

## 📚 Additional Resources

- **Azure** - https://azure.microsoft.com/
- **CDKTF** - https://developer.hashicorp.com/terraform/cdktf
- **GitHub Actions** - https://docs.github.com/en/actions
- **Kubernetes** - https://kubernetes.io/
- **ArgoCD** - https://argo-cd.readthedocs.io/

---

## 🎓 Learning Path

**Week 1**: Get dev environment running  
**Week 2**: Deploy staging, explore Azure portal  
**Week 3**: Set up monitoring and alerts  
**Week 4**: Deploy prod, configure backups  

---

## 📞 Support Channels

1. **Check Documentation** - See files listed at top
2. **Review Workflow Logs** - GitHub Actions tab
3. **Test Locally** - `cd infra && npm run build`
4. **Azure Support** - Azure portal support options
5. **Community** - Stack Overflow, Azure forums

---

## 🏁 Next Steps

1. ✅ Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (5 min)
2. ✅ Follow [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) (20 min)
3. ✅ Deploy to dev (push to main)
4. ✅ Verify resources in Azure
5. ✅ Access deployed applications
6. ✅ Configure staging/prod (optional)

---

## 📝 Files Reference

| File | Purpose | Read Time |
|------|---------|-----------|
| **QUICK_REFERENCE.md** | Essential commands & troubleshooting | 5 min |
| **SETUP_SUMMARY.md** | Overview of what's been set up | 10 min |
| **GITHUB_ACTIONS_SETUP.md** | Step-by-step setup guide | 20 min |
| **AZURE_CLI_REFERENCE.md** | Azure CLI commands reference | Reference |
| **SECRETS.md** | Secret configuration guide | 10 min |
| **../DEPLOYMENT_GUIDE.md** | Complete deployment guide | 30 min |
| **../infra/README.md** | Infrastructure components | 10 min |

---

**Version**: 1.0  
**Last Updated**: March 19, 2024  
**Status**: ✅ Production Ready

