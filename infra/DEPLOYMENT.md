# RecipeBox Infrastructure as Code

This directory contains the infrastructure setup for RecipeBox using CDKTF (CDK for Terraform).

## Architecture Overview

- **Azure Container Registry (ACR)**: Docker image registry
- **Azure Kubernetes Service (AKS)**: Managed Kubernetes cluster
- **Azure PostgreSQL Flexible Server**: Database server
- **Azure Storage Account**: Static website hosting
- **Azure CDN**: Content delivery network
- **Azure Key Vault**: Secrets management
- **ArgoCD**: GitOps continuous deployment

## Prerequisites

- **Node.js**: 18+
- **CDKTF CLI**: `npm install -g cdktf-cli`
- **Terraform**: Latest version
- **Azure CLI**: Installed and authenticated
- **Azure Subscription**: With appropriate permissions

## Environment Setup

### 1. Copy Environment Configuration

```bash
cd infra
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` and set the following:

**ENVIRONMENT** (dev/staging/prod)
- Controls resource sizing and cost
- dev: Minimal resources (1 AKS node, Basic ACR)
- staging: Medium resources (2 AKS nodes, Standard ACR, GRS storage)
- prod: High availability (3 AKS nodes, Premium ACR, GRS storage)

**GITHUB_REPOSITORY_URL**
```
https://github.com/YOUR-ORG/recipebox
```

**POSTGRES_PASSWORD** (Strong password required)
- Minimum 8 characters
- Must include uppercase, lowercase, number, special character
- Example: `MySecureP@ssw0rd123`

**AZURE_CREDENTIALS** (JSON format)

Get credentials from Azure CLI:
```bash
az ad sp create-for-rbac --role Contributor --scopes /subscriptions/YOUR-SUBSCRIPTION-ID
```

Then set:
```json
{
  "subscriptionId": "YOUR-SUBSCRIPTION-ID",
  "tenantId": "YOUR-TENANT-ID",
  "clientId": "YOUR-CLIENT-ID",
  "clientSecret": "YOUR-CLIENT-SECRET"
}
```

### 3. Validate Environment

```bash
# Source environment variables
export $(cat .env | xargs)

# Verify CDKTF setup
npm install
npm run build

# Review what will be deployed
npx cdktf plan
```

## Deployment

### Local Deployment

```bash
# Deploy infrastructure
npx cdktf deploy recipebox-infra

# Approve changes when prompted
# Wait for deployment to complete (~15-20 minutes)

# Get outputs
npx cdktf output recipebox-infra
```

### GitHub Actions Deployment

1. **Set GitHub Secrets** (in repository Settings → Secrets):
   - `AZURE_CREDENTIALS`: JSON from Azure CLI
   - `POSTGRES_PASSWORD`: Strong password
   - `GITHUB_REPOSITORY_URL`: Repository URL

2. **Trigger Deployment**:
   - Push to `main` branch
   - Or manually trigger workflow: "Deploy to AKS"

## Key Vault Secrets Management

All sensitive data is stored in Azure Key Vault:

- PostgreSQL password: `recipebox-kv-env/secrets/postgres-password`

Retrieve secrets:
```bash
az keyvault secret show --vault-name recipebox-kv-dev --name postgres-password
```

## PostgreSQL Firewall Rules

Configured firewall rules:

1. **AllowAzureServices**: Allows internal Azure services (0.0.0.0)
2. **AllowAKS**: Allows AKS cluster (10.0.0.0 - 10.255.255.255)

**For Production**: Replace firewall rules with Private Endpoint connections.

## Database Access

### From AKS Cluster

```bash
# Get kubeconfig
npx cdktf output recipebox-infra | grep kube_config

# Connect to database from pod
PGPASSWORD=YOUR_PASSWORD psql -h recipebox-pg-dev.postgres.database.azure.com -U pgadmin -d recipebox
```

### From Local Machine

```bash
# Enable firewall rule for your IP
az postgres flexible-server firewall-rule create \
  --resource-group rg-recipebox-dev \
  --name recipebox-pg-dev \
  --rule-name MyIP \
  --start-ip-address YOUR_IP \
  --end-ip-address YOUR_IP
```

## Terraform Outputs

After deployment, retrieve outputs:

```bash
# All outputs
npx cdktf output recipebox-infra

# Specific output
npx cdktf output recipebox-infra acr_login_server
```

Key outputs:
- `acr_login_server`: Container registry login server
- `acr_name`: Container registry name
- `cdn_endpoint`: CDN FQDN for static frontend
- `postgresql_fqdn`: PostgreSQL server FQDN
- `storage_account_name`: Storage account for frontend deployment
- `resource_group_name`: Resource group name
- `environment`: Deployed environment name

## State Management

Terraform state is stored in Terraform Cloud (configured in cdktf.json).

If using local state instead:
```bash
# Initialize local state
npx cdktf init --local

# Never commit tfstate files to Git
echo "*.tfstate*" >> .gitignore
```

## Destroy Infrastructure

⚠️ **WARNING**: This will delete all resources.

```bash
npx cdktf destroy recipebox-infra
```

## Troubleshooting

### CDKTF Build Fails

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
npm run get
npm run build
```

### Azure Authentication Issues

```bash
# Login to Azure
az login

# Set subscription
az account set --subscription YOUR-SUBSCRIPTION-ID

# Verify
az account show
```

### PostgreSQL Connection Issues

```bash
# Check firewall rules
az postgres flexible-server firewall-rule list \
  --resource-group rg-recipebox-dev \
  --server-name recipebox-pg-dev
```

## Environment-Specific Configurations

### Development
- Minimal costs
- 1 AKS node (Standard_DS2_v2)
- Basic ACR, LRS storage
- Suitable for testing and development

### Staging
- Medium costs
- 2 AKS nodes (Standard_DS3_v2)
- Standard ACR, GRS storage
- Pre-production environment

### Production
- High costs
- 3 AKS nodes (Standard_DS3_v2)
- Premium ACR, GRS storage
- Highly available setup

## Security Best Practices

1. **Never commit secrets** to Git (`.gitignore` has sensitive files)
2. **Use Key Vault** for all secret management
3. **Rotate credentials** regularly
4. **Use Private Endpoints** (prod) instead of firewall rules
5. **Enable audit logging** for Key Vault access
6. **Implement RBAC** for fine-grained access control
7. **Enable disk encryption** for AKS nodes

## Cost Estimation

Approximate monthly costs (USD):

**Development** (~$150-200):
- AKS: $50-70
- PostgreSQL: $30-40
- Storage/CDN: $20-40
- Other: $20-30

**Staging** (~$400-500):
- AKS: $150-200
- PostgreSQL: $80-100
- Storage/CDN: $80-100
- Other: $20-30

**Production** (~$800-1200):
- AKS: $250-350
- PostgreSQL: $150-200
- Storage/CDN: $150-200
- Other: $50-70

## Maintenance

### Regular Tasks

- **Weekly**: Review key vault access logs
- **Monthly**: Update CDKTF providers and dependencies
- **Quarterly**: Review and optimize resource sizing
- **Annually**: Review security configurations and compliance

### Updates

```bash
# Update CDKTF
npm run upgrade

# Update providers
npm run upgrade:provider
```

## Support & Documentation

- [CDKTF Documentation](https://developer.hashicorp.com/terraform/cdktf)
- [Azure Provider Documentation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure Architecture Center](https://learn.microsoft.com/azure/architecture/)

## Contributing

When making infrastructure changes:

1. Test locally first with `cdktf plan`
2. Create a pull request with detailed description
3. Get approval from team lead
4. Deploy using GitHub Actions
5. Document any manual steps

## License

Same as RecipeBox project
