# RecipeBox Infrastructure Setup - Quick Start

## ✅ Completed Setup

### 1. **Azure Credentials Generated**
- Service Principal: `RecipeBoxGitHub`
- Role: `Contributor`
- Subscription: `18626bef-7c03-4014-b3ed-776b7cac3f37`

### 2. **Local Configuration**
Created `.env` file with:
- `ENVIRONMENT=dev` (configurable: dev/staging/prod)
- `GITHUB_REPOSITORY_URL=https://github.com/yuriykravtsov/RecipeBox`
- `POSTGRES_PASSWORD=MyRecipeBox@2024!`
- `AZURE_CREDENTIALS` (JSON with subscription, client, secret, tenant)

### 3. **Dependencies Installed**
- Terraform CLI: v1.5.7
- npm dependencies: 787 packages
- dotenv: For loading .env files

### 4. **Infrastructure Validated**
```bash
cd infra
npm run build          # ✅ TypeScript compiled successfully
npm run get            # ✅ CDKTF providers generated
npx cdktf synth        # ✅ Terraform JSON generated
```

### 5. **Code Changes Committed**
- Updated `infra/main.ts` with dotenv support
- Enhanced `deploy.yaml` workflow with environment selection
- Added comprehensive documentation
- Updated `.gitignore` to protect secrets

## 🚀 Next Steps

### Option A: Deploy Locally (Recommended for Testing)
```bash
cd infra

# Review what will be created
npx cdktf plan recipebox-infra

# Deploy (optional)
npx cdktf deploy recipebox-infra

# Get outputs
npx cdktf output recipebox-infra
```

### Option B: Deploy via GitHub Actions

1. **Add GitHub Secrets** (Settings → Secrets and variables → Actions):

```json
{
  "AZURE_CREDENTIALS": {
    "subscriptionId": "18626bef-7c03-4014-b3ed-776b7cac3f37",
    "clientId": "a380d7ca-5c75-469c-ada2-af7a0d1160cd",
    "clientSecret": "Ltb8Q~XLsVtA1Xo.ILSzKBNc5MQsI5KgXk0-_b7S",
    "tenantId": "95c0cc1f-73c8-4f83-9555-0578c10403a0"
  },
  "POSTGRES_PASSWORD": "MyRecipeBox@2024!",
  "GITHUB_REPOSITORY_URL": "https://github.com/yuriykravtsov/RecipeBox"
}
```

2. **Trigger Deployment**:
   - Push to `main` branch, OR
   - Manually trigger: Actions → Deploy to AKS → Run workflow

## 📋 Key Files

- `infra/main.ts` - Infrastructure as Code (CDKTF)
- `infra/.env` - Local configuration (⚠️ NOT in git)
- `infra/.env.example` - Template for .env
- `infra/DEPLOYMENT.md` - Full deployment guide
- `.github/SECRETS.md` - Secrets configuration guide
- `.github/workflows/deploy.yaml` - CI/CD pipeline

## 🔐 Security Notes

- `.env` file is gitignored (secrets protected)
- PostgreSQL password enforcer (strong passwords only)
- Azure Key Vault for production secrets
- Service principal with limited scope

## 📊 Resource Summary (Dev Environment)

| Resource | Type | Cost Estimate |
|----------|------|----------------|
| AKS | 1 node (DS2_v2) | ~$50-70/mo |
| PostgreSQL | B_Standard_B1ms | ~$30-40/mo |
| Storage + CDN | LRS | ~$20-40/mo |
| Key Vault | Standard | ~$0.60/mo |
| **Total** | | **~$150-200/mo** |

## 🎯 Environment Options

### Development (Current)
- Minimal resources, cost-optimized
- 1 AKS node, Basic ACR, LRS storage
- Use for: Testing, development

### Staging
```bash
ENVIRONMENT=staging npx cdktf deploy
```
- Medium resources
- 2 AKS nodes, Standard ACR, GRS storage

### Production
```bash
ENVIRONMENT=prod npx cdktf deploy
```
- High availability
- 3 AKS nodes, Premium ACR, GRS storage

## ⚠️ Important

1. **Do NOT commit `.env` file** (already in .gitignore)
2. **Keep credentials secure** (rotate every 90 days)
3. **Test plan first** before deployment
4. **Cost implications** - resources will incur Azure charges

## 🆘 Troubleshooting

### Plan fails with auth error
```bash
az login  # Re-authenticate
az account set --subscription 18626bef-7c03-4014-b3ed-776b7cac3f37
```

### Terraform not found
```bash
brew install terraform  # macOS
```

### Cannot load .env
```bash
npm install dotenv --save  # Already done, but if needed
npm run build              # Rebuild
```

## 📞 Getting Help

- Read `infra/DEPLOYMENT.md` for detailed instructions
- Check `.github/SECRETS.md` for secrets setup
- Run `cdktf --help` for CDKTF options

---

**Status**: ✅ Ready for deployment
**Last Updated**: March 18, 2026
