# Quick Reference Card

## 🚀 60-Second Start

```bash
# 1. Install tools
brew install azure-cli gh

# 2. Login to Azure
az login

# 3. Get subscription ID
az account show --query id -o tsv

# 4. Create service principal (copy the JSON output)
az ad sp create-for-rbac --name RecipeBoxGitHub --role Contributor --scopes /subscriptions/<YOUR-SUBSCRIPTION-ID>

# 5. Add GitHub secret
gh secret set AZURE_CREDENTIALS --body '{
  "subscriptionId": "...",
  "clientId": "...",
  "clientSecret": "...",
  "tenantId": "..."
}'

# 6. Add password secret
gh secret set POSTGRES_PASSWORD --body "MyRecipeBox@2024!"

# 7. Done! Push changes to deploy
git push origin main
```

---

## 📋 Essential Commands

### Azure Authentication
```bash
az login                          # Interactive login
az account show                   # Show current account
az account set --subscription ID  # Switch subscription
```

### Resource Management
```bash
az group list --query "[?tags.ManagedBy=='Terraform']" -o table
az resource list --resource-group rg-recipebox-dev -o table
az group delete --name rg-recipebox-dev --yes  # DELETE!
```

### Kubernetes
```bash
az aks get-credentials --resource-group rg-recipebox-dev --name recipebox-aks-dev
kubectl cluster-info
kubectl get nodes
kubectl get pods -n argocd
```

### PostgreSQL
```bash
# Get connection info
az postgres flexible-server show --name recipebox-pg-dev --resource-group rg-recipebox-dev --query fullyQualifiedDomainName -o tsv

# Connect
psql -h <host> -U pgadmin -d recipebox

# Create backup
az postgres flexible-server backup create --name recipebox-pg-dev --resource-group rg-recipebox-dev
```

### Container Registry
```bash
# Login
az acr login --name recipeboxacrdev

# Push image
docker tag myimage recipeboxacrdev.azurecr.io/myimage:latest
docker push recipeboxacrdev.azurecr.io/myimage:latest

# List images
az acr repository list --name recipeboxacrdev
```

### GitHub Actions
```bash
gh secret list                           # List all secrets
gh secret view AZURE_CREDENTIALS          # View secret value
gh run list --workflow deploy.yml         # List deployments
gh run view <run-id> --log               # View logs
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | Infrastructure deployment |
| `.github/workflows/build.yml` | Container builds |
| `infra/main.ts` | Infrastructure code |
| `.github/GITHUB_ACTIONS_SETUP.md` | Full setup guide |
| `.github/AZURE_CLI_REFERENCE.md` | Azure commands |
| `DEPLOYMENT_GUIDE.md` | Getting started guide |
| `infra/.env.example` | Environmental variables |

---

## 🔐 Required Secrets

| Secret | Example Value |
|--------|---------------|
| `AZURE_CREDENTIALS` | `{"subscriptionId":"...","clientId":"...","clientSecret":"...","tenantId":"..."}` |
| `POSTGRES_PASSWORD` | `MyRecipeBox@2024!` |

---

## 🎯 Common Workflows

### Deploy Infrastructure
```bash
git add infra/
git commit -m "Update infrastructure"
git push origin main
# Automatically deploys to dev
```

### Manual Deploy to Staging
1. Go to GitHub Actions
2. Select "Deploy Infrastructure"
3. Click "Run workflow"
4. Select environment: `staging`
5. Select action: `apply`

### Check Deployment Status
```bash
gh run list --workflow deploy.yml
gh run view <run-id> --log
```

### Access ArgoCD
```bash
kubectl port-forward -n argocd svc/argocd-server 8080:443
# Open https://localhost:8080
# Get password: kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Workflow fails: "Secrets not found" | Run `gh secret list` to verify |
| PostgreSQL connection refused | Add firewall rule via `az postgres flexible-server firewall-rule create` |
| AKS deployment hangs | Normal - takes 10-20 minutes. Check `az aks show` status |
| Azure CLI auth fails | Run `az login` again |
| Container image won't push | Verify ACR login with `az acr login --name recipeboxacrdev` |

---

## 📊 Cost Watch

```bash
# Estimate costs
az resource list --resource-group rg-recipebox-dev -o json | grep -i sku

# Clean up to save costs
az group delete --name rg-recipebox-staging --yes
```

---

## 🔗 Documentation Map

- **Setup**: Start → `.github/GITHUB_ACTIONS_SETUP.md`
- **Deployment**: `DEPLOYMENT_GUIDE.md`
- **Azure Commands**: `.github/AZURE_CLI_REFERENCE.md`
- **Overall Summary**: `.github/SETUP_SUMMARY.md`
- **Infrastructure**: `infra/README.md`

---

## ✅ Checklist

- [ ] Azure CLI installed
- [ ] GitHub CLI installed
- [ ] Logged into Azure
- [ ] Service principal created
- [ ] `AZURE_CREDENTIALS` secret added
- [ ] `POSTGRES_PASSWORD` secret added
- [ ] Push to main to start deployment
- [ ] Verify workflow in GitHub Actions
- [ ] Access deployed resources
- [ ] Set up monitoring (optional)

---

## 💡 Pro Tips

1. **Always test locally first** (if changing infrastructure)
2. **Use staging before prod** to catch issues
3. **Keep secrets secure** - never commit credentials
4. **Monitor costs** - Azure bills quickly
5. **Use resource tags** for organization
6. **Backup databases** before destructive changes
7. **Test disaster recovery** periodically

---

**Questions?** See the full documentation files listed above.  
**Need help?** Check `DEPLOYMENT_GUIDE.md` troubleshooting section.

