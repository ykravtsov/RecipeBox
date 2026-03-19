# Azure CLI Quick Reference Guide

This document provides common `az` commands for managing the RecipeBox infrastructure.

## Prerequisites

```bash
# Install Azure CLI
# macOS with Homebrew
brew install azure-cli

# Verify installation
az --version
```

## Authentication

```bash
# Login to Azure interactively
az login

# Login with service principal (for CI/CD)
az login --service-principal \
  -u $AZURE_CLIENT_ID \
  -p $AZURE_CLIENT_SECRET \
  --tenant $AZURE_TENANT_ID

# Show current subscription
az account show --query "{name:name, id:id, tenantId:tenantId}" -o json

# List all subscriptions
az account list -o table

# Switch subscription
az account set --subscription "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Resource Group Management

```bash
# List resource groups
az group list -o table

# Get resource group with tags
az group list --query "[?tags.ManagedBy=='Terraform']" -o table

# Get specific resource group details
az group show \
  --name rg-recipebox-dev \
  --query "{name:name, location:location, tags:tags}" -o json

# List all resources in a resource group
az resource list \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, type:type, location:location}" -o table

# Delete resource group (WARNING: deletes all resources)
az group delete \
  --name rg-recipebox-dev \
  --yes \
  --no-wait
```

## Kubernetes Cluster (AKS)

```bash
# Get AKS cluster credentials
az aks get-credentials \
  --resource-group rg-recipebox-dev \
  --name recipebox-aks-dev

# Show AKS cluster details
az aks show \
  --resource-group rg-recipebox-dev \
  --name recipebox-aks-dev \
  --query "{name:name, fqdn:fqdn, nodeResourceGroup:nodeResourceGroup}" -o json

# Get AKS node resource group
az aks show \
  --resource-group rg-recipebox-dev \
  --name recipebox-aks-dev \
  --query "nodeResourceGroup" -o tsv

# List AKS nodes
az aks nodepool list \
  --resource-group rg-recipebox-dev \
  --cluster-name recipebox-aks-dev \
  -o table

# Scale AKS cluster
az aks nodepool scale \
  --resource-group rg-recipebox-dev \
  --cluster-name recipebox-aks-dev \
  --name default \
  --node-count 3

# Get AKS cluster versions
az aks get-versions \
  --location "West US 2" \
  --query "orchestrationSettings.orchestrationVersion" -o tsv

# Upgrade AKS cluster (non-disruptive)
az aks upgrade \
  --resource-group rg-recipebox-dev \
  --name recipebox-aks-dev \
  --kubernetes-version 1.27.0 \
  --yes
```

## Container Registry (ACR)

```bash
# List container registries
az acr list \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, loginServer:loginServer}" -o table

# Get ACR credentials
az acr credential show \
  --name recipeboxacrdev \
  --resource-group rg-recipebox-dev \
  --query "{username:username, password:passwords[0].value}" -o json

# Login to ACR
az acr login --name recipeboxacrdev

# List repositories
az acr repository list \
  --name recipeboxacrdev \
  --query "[]" -o table

# List image tags
az acr repository show-tags \
  --name recipeboxacrdev \
  --repository recipebox-api \
  --query "[]" -o table

# Delete image
az acr repository delete \
  --name recipeboxacrdev \
  --image recipebox-api:old-tag \
  --yes

# Get ACR webhook triggers
az acr webhook list \
  --registry recipeboxacrdev \
  --resource-group rg-recipebox-dev \
  -o table
```

## PostgreSQL Flexible Server

```bash
# List PostgreSQL servers
az postgres flexible-server list \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, host:fullyQualifiedDomainName, user:administratorLogin}" -o table

# Get PostgreSQL server details
az postgres flexible-server show \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  --query "{name:name, host:fullyQualifiedDomainName, version:version, skuName:sku.name}" -o json

# List PostgreSQL firewall rules
az postgres flexible-server firewall-rule list \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  -o table

# Add firewall rule (allow specific IP)
az postgres flexible-server firewall-rule create \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  --rule-name AllowMyIP \
  --start-ip-address 203.0.113.1 \
  --end-ip-address 203.0.113.1

# Add firewall rule (allow IP range)
az postgres flexible-server firewall-rule create \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  --rule-name AllowOffice \
  --start-ip-address 203.0.113.0 \
  --end-ip-address 203.0.113.255

# Remove firewall rule
az postgres flexible-server firewall-rule delete \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  --rule-name AllowMyIP \
  --yes

# Connect to PostgreSQL
psql -h recipebox-pg-dev.postgres.database.azure.com \
  -U pgadmin \
  -d recipebox

# Get PostgreSQL connection string
PGHOST="recipebox-pg-dev.postgres.database.azure.com"
PGUSER="pgadmin"
PGDATABASE="recipebox"

# List databases
az postgres flexible-server db list \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev \
  --query "[].name" -o table

# Create database backup
az postgres flexible-server backup create \
  --name recipebox-pg-dev \
  --resource-group rg-recipebox-dev
```

## Storage Account

```bash
# List storage accounts
az storage account list \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, tier:accessTier, kind:kind}" -o table

# Get storage account connection string
az storage account show-connection-string \
  --name recipeboxdevstorage \
  --resource-group rg-recipebox-dev

# Get storage account keys
az storage account keys list \
  --name recipeboxdevstorage \
  --resource-group rg-recipebox-dev

# List containers
az storage container list \
  --account-name recipeboxdevstorage \
  --query "[].name" -o table

# Upload file to storage
az storage blob upload \
  --account-name recipeboxdevstorage \
  --container-name \$web \
  --name index.html \
  --file index.html

# Get storage account static website properties
az storage account show \
  --name recipeboxdevstorage \
  --resource-group rg-recipebox-dev \
  --query "staticWebsite" -o json
```

## Key Vault

```bash
# List key vaults
az keyvault list \
  --resource-group rg-recipebox-dev \
  --query "[].name" -o table

# Show key vault details
az keyvault show \
  --name recipebox-kv-dev \
  --resource-group rg-recipebox-dev

# List secrets
az keyvault secret list \
  --vault-name recipebox-kv-dev \
  --query "[].name" -o table

# Get secret value
az keyvault secret show \
  --vault-name recipebox-kv-dev \
  --name postgres-password \
  --query "value" -o tsv

# Set secret value
az keyvault secret set \
  --vault-name recipebox-kv-dev \
  --name my-secret \
  --value "secret-value"

# Delete secret
az keyvault secret delete \
  --vault-name recipebox-kv-dev \
  --name my-secret
```

## CDN

```bash
# List CDN profiles
az cdn profile list \
  --resource-group rg-recipebox-dev \
  --query "[].name" -o table

# List CDN endpoints
az cdn endpoint list \
  --profile-name recipebox-cdn-dev \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, host:hostName}" -o table

# Get CDN endpoint URL
az cdn endpoint show \
  --name recipebox-frontend-dev \
  --profile-name recipebox-cdn-dev \
  --resource-group rg-recipebox-dev \
  --query "hostName" -o tsv

# Purge CDN cache
az cdn endpoint purge \
  --name recipebox-frontend-dev \
  --profile-name recipebox-cdn-dev \
  --resource-group rg-recipebox-dev \
  --content-paths "/*"
```

## Service Principal Management

```bash
# List all service principals
az ad sp list --query "[].{displayName:displayName, appId:appId}" -o table

# Show service principal details
az ad sp show --id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Show assigned roles
az role assignment list --assignee xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx -o table

# Reset service principal credentials
az ad sp credential reset \
  --name RecipeBoxGitHub

# Delete service principal (WARNING: breaks deployments)
az ad sp delete --id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Monitoring and Diagnostics

```bash
# Get activity log for resource group
az monitor activity-log list \
  --resource-group rg-recipebox-dev \
  --query "[].{time:eventTimestamp, operation:operationName.value, status:status.value}" -o table

# Check AKS cluster health
kubectl cluster-info

# Get AKS cluster events
kubectl get events -n kube-system

# Check node status
kubectl get nodes

# Get pod logs
kubectl logs -n argocd deployment/argocd-server

# Port forward to service
kubectl port-forward -n argocd svc/argocd-server 8080:443
```

## Cost Management

```bash
# List all resources with their costs
az resource list \
  --resource-group rg-recipebox-dev \
  --query "[].{name:name, type:type, location:location}" -o table

# Estimate costs by exporting data
az costmanagement export create \
  --name RecipeBoxExport \
  --definition "{
    Type: 'Usage',
    Timeframe: 'MonthToDate',
    DataSetConfiguration: {
      Granularity: 'Daily'
    }
  }" \
  --schedule "{
    Status: 'Active',
    Recurrence: 'Monthly',
    RecurrencePeriod: '1'
  }" \
  --schedule-status Inactive \
  --delivery-info "{
    Destination: {
      ResourceId: '/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.Storage/storageAccounts/{storageAccount}',
      Container: 'exports'
    }
  }"
```

## Disaster Recovery

```bash
# Create automated backup of PostgreSQL
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
  --source-server recipebox-pg-dev \
  --restore-time "2024-03-19T12:00:00Z"

# Create AKS cluster backup using Velero (install Velero first)
velero backup create recipebox-$(date +%Y%m%d%H%M%S)

# List Velero backups
velero backup get
```

## Tips and Tricks

```bash
# Output as JSON for scripting
--output json (-o json)

# Output as table
--output table (-o table)

# Output as TSV (Tab-Separated Values)
--output tsv (-o tsv)

# Query specific fields
--query "name,id,location"

# Add environment variable for subscriptionId to avoid repeating it
export AZURE_DEFAULTS_GROUP="rg-recipebox-dev"

# Get help for any command
az <command> --help

# Enable shell completion for bash
eval "$(az completion install)"

# Save environment variables in .env for scripting
export SUBSCRIPTION_ID=$(az account show --query id -o tsv)
export RESOURCE_GROUP="rg-recipebox-dev"
export CLUSTER_NAME="recipebox-aks-dev"
```

## Useful Links

- [Azure CLI Documentation](https://learn.microsoft.com/cli/azure/)
- [Azure Resource Manager](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/overview)
- [PostgreSQL Flexible Server Docs](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/)
- [Azure Kubernetes Service (AKS)](https://learn.microsoft.com/en-us/azure/aks/)
- [Azure Container Registry](https://learn.microsoft.com/en-us/azure/container-registry/)

