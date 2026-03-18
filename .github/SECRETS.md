# GitHub Secrets Configuration

This document explains how to configure the required GitHub Secrets for the RecipeBox deployment pipeline.

## Required Secrets

### 1. AZURE_CREDENTIALS

**Purpose**: Authenticate with Azure for infrastructure deployment  
**Type**: JSON string

**How to generate**:

```bash
# Install Azure CLI first: https://learn.microsoft.com/cli/azure/install-azure-cli

# 1. Login to Azure
az login

# 2. Get your subscription ID
az account show --query id -o tsv

# 3. Create a service principal with Contributor role
az ad sp create-for-rbac \
  --name "RecipeBoxGitHub" \
  --role Contributor \
  --scopes /subscriptions/YOUR-SUBSCRIPTION-ID
```

**Output will look like**:
```json
{
  "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "RecipeBoxGitHub",
  "password": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenant": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Format for GitHub Secret**:
```json
{
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Steps to add to GitHub**:
1. Navigate to your repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `AZURE_CREDENTIALS`
5. Paste the JSON string (all on one line if needed)
6. Click **Add secret**

---

### 2. POSTGRES_PASSWORD

**Purpose**: PostgreSQL database administrator password  
**Type**: String

**Requirements**:
- Minimum 8 characters
- Must include:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - At least one special character (!@#$%^&*-_.+=\|)

**Example valid passwords**:
- `MyRecipeP@ssw0rd`
- `Secure#Pass123!`
- `Database_P@ss2024`

**NEVER**:
- Use simple passwords like `password123`
- Use the same password for multiple services
- Share the password in Git commits or PRs
- Use common patterns

**Steps to add to GitHub**:
1. Navigate to your repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `POSTGRES_PASSWORD`
5. Paste your strong password
6. Click **Add secret**

---

### 3. GITHUB_REPOSITORY_URL

**Purpose**: Full URL to the GitHub repository for ArgoCD GitOps  
**Type**: String  
**Format**: `https://github.com/YOUR-ORG/recipebox`

**Example**: `https://github.com/acme-corp/recipebox`

**Steps to add to GitHub**:
1. Navigate to your repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `GITHUB_REPOSITORY_URL`
5. Paste: `https://github.com/YOUR-USERNAME-OR-ORG/recipebox`
6. Click **Add secret**

---

## Verification

### Verify Secrets are Set

```bash
# List all secrets (names only, values hidden)
gh secret list
```

### Verify Secret Content (CLI)

```bash
# Read a specific secret
gh secret view POSTGRES_PASSWORD

# Read Azure credentials
gh secret view AZURE_CREDENTIALS
```

### Test the Configuration Locally

Before pushing to main:

```bash
# 1. Set environment variables
export AZURE_CREDENTIALS='{"subscriptionId":"...","clientId":"...","clientSecret":"...","tenantId":"..."}'
export POSTGRES_PASSWORD='MySecurePassword123!'
export GITHUB_REPOSITORY_URL='https://github.com/your-org/recipebox'

# 2. Navigate to infra
cd infra

# 3. Install dependencies
npm install

# 4. Build CDKTF
npm run build

# 5. Plan deployment (dry-run)
npx cdktf plan
```

If the plan succeeds, your configuration is valid.

---

## Security Best Practices

### ✅ DO:
- Rotate service principal passwords every 90 days
- Use strong, randomly generated passwords
- Store backups securely (not in Git)
- Use separate service principals for dev/staging/prod
- Review secret access logs regularly
- Limit service principal permissions to what's needed
- Use secrets expiration where possible

### ❌ DON'T:
- Commit secrets to Git (use `.gitignore`)
- Share secrets via email or chat
- Use the same secret across multiple environments
- Hardcode secrets in code or scripts
- Log secrets in CI/CD output
- Use excessively permissive roles (avoid Owner role)

---

## Troubleshooting

### "Invalid Azure Credentials"

**Solution**:
1. Verify JSON format (ensure it's on one line with no line breaks)
2. Check that all fields are present: `subscriptionId`, `clientId`, `clientSecret`, `tenantId`
3. Ensure the service principal hasn't expired
4. Recreate the service principal if needed

### "PostgreSQL Password Requirements Not Met"

**Solution**:
- Ensure password has: uppercase + lowercase + number + special character
- Minimum 8 characters
- Try: `MyRecipe@2024`

### "Secret Not Found in Workflow"

**Solution**:
1. Verify secret name exactly matches: `POSTGRES_PASSWORD`, `AZURE_CREDENTIALS`, `GITHUB_REPOSITORY_URL`
2. Secret names are case-sensitive
3. Wait a few minutes after adding a secret for it to be available
4. Refresh the page

---

## Rotation Schedule

| Secret | Rotation Frequency | Next Review |
|--------|-------------------|-------------|
| AZURE_CREDENTIALS | Every 90 days | [Set reminder] |
| POSTGRES_PASSWORD | Every 180 days | [Set reminder] |
| GITHUB_REPOSITORY_URL | As needed (on org/repo change) | N/A |

---

## Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Azure Service Principal Documentation](https://learn.microsoft.com/azure/active-directory/develop/app-objects-and-service-principals)
- [PostgreSQL Password Policy](https://www.postgresql.org/docs/current/sql-createrole.html)
