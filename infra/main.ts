import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput } from "cdktf";
import { AzurermProvider } from "@cdktf/provider-azurerm/lib/provider";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { ContainerRegistry } from "@cdktf/provider-azurerm/lib/container-registry";
import { KubernetesCluster } from "@cdktf/provider-azurerm/lib/kubernetes-cluster";
import { RoleAssignment } from "@cdktf/provider-azurerm/lib/role-assignment";
import { KubernetesProvider } from "@cdktf/provider-kubernetes/lib/provider";
import { HelmProvider } from "@cdktf/provider-helm/lib/provider";
import { Namespace } from "@cdktf/provider-kubernetes/lib/namespace";
import { Release } from "@cdktf/provider-helm/lib/release";
import { PostgresqlFlexibleServer } from "@cdktf/provider-azurerm/lib/postgresql-flexible-server";
import { PostgresqlFlexibleServerDatabase } from "@cdktf/provider-azurerm/lib/postgresql-flexible-server-database";
import { PostgresqlFlexibleServerFirewallRule } from "@cdktf/provider-azurerm/lib/postgresql-flexible-server-firewall-rule";
import { StorageAccount } from "@cdktf/provider-azurerm/lib/storage-account";
import { CdnProfile } from "@cdktf/provider-azurerm/lib/cdn-profile";
import { CdnEndpoint } from "@cdktf/provider-azurerm/lib/cdn-endpoint";
import { KeyVault } from "@cdktf/provider-azurerm/lib/key-vault";
import { KeyVaultSecret } from "@cdktf/provider-azurerm/lib/key-vault-secret";
import { DataAzurermClientConfig } from "@cdktf/provider-azurerm/lib/data-azurerm-client-config";

/**
 * Environment Configuration
 * Adjust these values for different environments (dev, staging, prod)
 */
interface EnvironmentConfig {
  name: string;
  location: string;
  acrSku: string;
  aksNodeCount: number;
  aksVmSize: string;
  pgSkuName: string;
  pgStorageMb: number;
  storageAccountTier: string;
  storageAccountReplication: string;
  cdnSku: string;
  tags: Record<string, string>;
}

const ENV = process.env.ENVIRONMENT || "dev";

const environmentConfigs: Record<string, EnvironmentConfig> = {
  dev: {
    name: "dev",
    location: "East US",
    acrSku: "Basic",
    aksNodeCount: 1,
    aksVmSize: "Standard_DS2_v2",
    pgSkuName: "B_Standard_B1ms",
    pgStorageMb: 32768,
    storageAccountTier: "Standard",
    storageAccountReplication: "LRS",
    cdnSku: "Standard_Microsoft",
    tags: {
      Environment: "dev",
      ManagedBy: "Terraform",
      CostCenter: "development",
    },
  },
  staging: {
    name: "staging",
    location: "East US",
    acrSku: "Standard",
    aksNodeCount: 2,
    aksVmSize: "Standard_DS3_v2",
    pgSkuName: "GP_Standard_D2s_v3",
    pgStorageMb: 65536,
    storageAccountTier: "Standard",
    storageAccountReplication: "GRS",
    cdnSku: "Standard_Microsoft",
    tags: {
      Environment: "staging",
      ManagedBy: "Terraform",
      CostCenter: "staging",
    },
  },
  prod: {
    name: "prod",
    location: "East US",
    acrSku: "Premium",
    aksNodeCount: 3,
    aksVmSize: "Standard_DS3_v2",
    pgSkuName: "GP_Standard_D4s_v3",
    pgStorageMb: 131072,
    storageAccountTier: "Premium",
    storageAccountReplication: "GRS",
    cdnSku: "Premium_Microsoft",
    tags: {
      Environment: "prod",
      ManagedBy: "Terraform",
      CostCenter: "production",
    },
  },
};

const config = environmentConfigs[ENV] || environmentConfigs.dev;

// Force initial build trigger

class MyStack extends TerraformStack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // REQUIRED GITHUB SECRETS (set these before deployment):
        // - AZURE_CREDENTIALS: JSON object with subscriptionId, tenantId, clientId, clientSecret
        // - POSTGRES_PASSWORD: Strong password (min 8 chars, must include uppercase, lowercase, number, special char)
        // - GITHUB_REPOSITORY_URL: Full URL to GitHub repository

        // Get configuration from environment variables
        const repoUrl = process.env.GITHUB_REPOSITORY_URL || "https://github.com/your-org/recipebox";
        const pgPassword = process.env.POSTGRES_PASSWORD;
        if (!pgPassword) {
            throw new Error("POSTGRES_PASSWORD environment variable is required");
        }
        const azureCreds = JSON.parse(process.env.AZURE_CREDENTIALS || '{"subscriptionId":"","tenantId":"","clientId":"","clientSecret":""}');

        new AzurermProvider(this, "AzureRm", {
            features: [{}],
            subscriptionId: azureCreds.subscriptionId,
            tenantId: azureCreds.tenantId,
            clientId: azureCreds.clientId,
            clientSecret: azureCreds.clientSecret,
        });

        // Get current Azure client configuration for Key Vault access policies
        const currentClientConfig = new DataAzurermClientConfig(this, "current-config", {});

        const rg = new ResourceGroup(this, "rg", {
            name: `rg-recipebox-${config.name}`,
            location: config.location,
            tags: config.tags,
        });

        // Azure Key Vault for secrets management
        const keyVault = new KeyVault(this, "keyvault", {
            name: `recipebox-kv-${config.name}`,
            location: rg.location,
            resourceGroupName: rg.name,
            tenantId: azureCreds.tenantId,
            skuName: "standard",
            enabledForDeployment: true,
            enabledForDiskEncryption: false,
            enabledForTemplateDeployment: true,
            accessPolicy: [
                {
                    tenantId: azureCreds.tenantId,
                    objectId: currentClientConfig.objectId,
                    keyPermissions: ["Get", "List", "Create", "Delete", "Update"],
                    secretPermissions: ["Get", "List", "Set", "Delete"],
                },
            ],
            tags: config.tags,
        });

        // Store PostgreSQL password in Key Vault
        new KeyVaultSecret(this, "pg-password-secret", {
            name: "postgres-password",
            value: pgPassword,
            keyVaultId: keyVault.id,
        });

        const acr = new ContainerRegistry(this, "acr", {
            name: `recipeboxacr${config.name}`,
            resourceGroupName: rg.name,
            location: rg.location,
            sku: config.acrSku,
            adminEnabled: true,
            tags: config.tags,
        });

        const storageAccount = new StorageAccount(this, "storage", {
            name: `recipebox${config.name}storage`,
            resourceGroupName: rg.name,
            location: rg.location,
            accountTier: config.storageAccountTier,
            accountReplicationType: config.storageAccountReplication,
            staticWebsite: {
                indexDocument: "index.html",
                error404Document: "index.html",
            },
            tags: config.tags,
        });

        const cdnProfile = new CdnProfile(this, "cdnProfile", {
            name: `recipebox-cdn-${config.name}`,
            location: rg.location,
            resourceGroupName: rg.name,
            sku: config.cdnSku,
            tags: config.tags,
        });

        const cdnEndpoint = new CdnEndpoint(this, "cdnEndpoint", {
            name: `recipebox-frontend-${config.name}`,
            profileName: cdnProfile.name,
            location: rg.location,
            resourceGroupName: rg.name,
            origin: [{
                name: "recipebox-origin",
                hostName: storageAccount.primaryWebHost,
            }],
            tags: config.tags,
        });

        const pgServer = new PostgresqlFlexibleServer(this, "pgServer", {
            name: `recipebox-pg-${config.name}`,
            resourceGroupName: rg.name,
            location: rg.location,
            skuName: config.pgSkuName,
            storageMb: config.pgStorageMb,
            version: "15",
            administratorLogin: "pgadmin",
            administratorPassword: pgPassword,
            zone: "1",
            tags: config.tags,
        });

        new PostgresqlFlexibleServerDatabase(this, "pgDb", {
            name: "recipebox",
            serverId: pgServer.id,
        });

        // PostgreSQL Firewall Rules for secure client access
        // Allow Azure Services to access PostgreSQL
        new PostgresqlFlexibleServerFirewallRule(this, "pg-allow-azure-services", {
            name: "AllowAzureServices",
            serverId: pgServer.id,
            startIpAddress: "0.0.0.0",
            endIpAddress: "0.0.0.0",
        });

        // Allow AKS to access PostgreSQL (optional: restrict to specific IPs if available)
        // Note: In production, use a private endpoint instead of firewall rules
        new PostgresqlFlexibleServerFirewallRule(this, "pg-allow-aks", {
            name: "AllowAKS",
            serverId: pgServer.id,
            startIpAddress: "10.0.0.0",
            endIpAddress: "10.255.255.255",
        });

        const aks = new KubernetesCluster(this, "aks", {
            name: `recipebox-aks-${config.name}`,
            location: rg.location,
            resourceGroupName: rg.name,
            dnsPrefix: `recipebox-${config.name}`,
            defaultNodePool: {
                name: "default",
                nodeCount: config.aksNodeCount,
                vmSize: config.aksVmSize,
                tags: config.tags,
            },
            identity: {
                type: "SystemAssigned",
            },
            roleBasedAccessControlEnabled: true,
            tags: config.tags,
        });

        new RoleAssignment(this, "acrPull", {
            scope: acr.id,
            roleDefinitionName: "AcrPull",
            principalId: aks.kubeletIdentity.objectId,
        });

        // Kubernetes provider
        new KubernetesProvider(this, "k8s", {
            host: aks.kubeConfig.get(0).host,
            clientCertificate: aks.kubeConfig.get(0).clientCertificate,
            clientKey: aks.kubeConfig.get(0).clientKey,
            clusterCaCertificate: aks.kubeConfig.get(0).clusterCaCertificate,
        });

        // Helm provider
        new HelmProvider(this, "helm", {
            kubernetes: {
                host: aks.kubeConfig.get(0).host,
                clientCertificate: aks.kubeConfig.get(0).clientCertificate,
                clientKey: aks.kubeConfig.get(0).clientKey,
                clusterCaCertificate: aks.kubeConfig.get(0).clusterCaCertificate,
            },
        });

        // ArgoCD namespace
        new Namespace(this, "argocd-ns", {
            metadata: {
                name: "argocd",
            },
        });

        // ArgoCD Helm release
        new Release(this, "argocd", {
            name: "argocd",
            repository: "https://argoproj.github.io/argo-helm",
            chart: "argo-cd",
            namespace: "argocd",
            set: [
                {
                    name: "server.service.type",
                    value: "LoadBalancer",
                },
            ],
        });

        // Note: ArgoCD Application resources are managed by GitOps (in k8s/application.yaml)
        // This allows ArgoCD to manage itself and prevents timing issues during initial deployment

        // Outputs
        new TerraformOutput(this, "environment", {
            value: config.name,
            description: "Deployed environment name",
        });

        new TerraformOutput(this, "acr_login_server", {
            value: acr.loginServer,
            description: "Azure Container Registry login server",
        });

        new TerraformOutput(this, "acr_name", {
            value: acr.name,
            description: "Azure Container Registry name",
        });

        new TerraformOutput(this, "kube_config", {
            value: aks.kubeConfigRaw,
            sensitive: true,
            description: "Kubernetes cluster kubeconfig",
        });

        new TerraformOutput(this, "cdn_endpoint", {
            value: cdnEndpoint.fqdn,
            description: "CDN endpoint FQDN for static frontend",
        });

        new TerraformOutput(this, "storage_account_name", {
            value: storageAccount.name,
            description: "Storage account name for frontend deployment",
        });

        new TerraformOutput(this, "postgresql_fqdn", {
            value: pgServer.fqdn,
            description: "PostgreSQL server FQDN",
        });

        new TerraformOutput(this, "key_vault_id", {
            value: keyVault.id,
            description: "Key Vault ID for secrets management",
        });

        new TerraformOutput(this, "resource_group_name", {
            value: rg.name,
            description: "Azure Resource Group name",
        });
    }
}

const app = new App();
new MyStack(app, "recipebox-infra");
app.synth();