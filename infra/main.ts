import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput, AzurermBackend } from "cdktf";
import { AzurermProvider } from "@cdktf/provider-azurerm/lib/provider";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { ContainerRegistry } from "@cdktf/provider-azurerm/lib/container-registry";
import { KubernetesCluster } from "@cdktf/provider-azurerm/lib/kubernetes-cluster";
import { PostgresqlFlexibleServer } from "@cdktf/provider-azurerm/lib/postgresql-flexible-server";
import { PostgresqlFlexibleServerDatabase } from "@cdktf/provider-azurerm/lib/postgresql-flexible-server-database";
import { PostgresqlFlexibleServerFirewallRule } from "@cdktf/provider-azurerm/lib/postgresql-flexible-server-firewall-rule";
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
  tags: Record<string, string>;
}

const ENV = process.env.ENVIRONMENT || "dev";

const environmentConfigs: Record<string, EnvironmentConfig> = {
  dev: {
    name: "dev",
    location: "West US 2",
    acrSku: "Basic",
    aksNodeCount: 1,
    aksVmSize: "Standard_DS2_v2",
    pgSkuName: "B_Standard_B1ms",
    pgStorageMb: 32768,
    tags: {
      Environment: "dev",
      ManagedBy: "Terraform",
      CostCenter: "development",
    },
  },
  staging: {
    name: "staging",
    location: "West US 2",
    acrSku: "Standard",
    aksNodeCount: 2,
    aksVmSize: "Standard_DS3_v2",
    pgSkuName: "GP_Standard_D2s_v3",
    pgStorageMb: 65536,
    tags: {
      Environment: "staging",
      ManagedBy: "Terraform",
      CostCenter: "staging",
    },
  },
  prod: {
    name: "prod",
    location: "West US 2",
    acrSku: "Premium",
    aksNodeCount: 3,
    aksVmSize: "Standard_DS3_v2",
    pgSkuName: "GP_Standard_D4s_v3",
    pgStorageMb: 131072,
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

        const rg = new ResourceGroup(this, "rg", {
            name: `rg-recipebox-${config.name}`,
            location: config.location,
            tags: config.tags,
        });

        const acr = new ContainerRegistry(this, "acr", {
            name: `recipeboxacr${config.name}`,
            resourceGroupName: rg.name,
            location: rg.location,
            sku: config.acrSku,
            adminEnabled: true,
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

        // Configure ACR pull permissions in post-deployment (requires User Access Administrator role)
        // See deploy.yml for kubectl apply of ArgoCD + image pull secrets

        // NOTE: ArgoCD is deployed separately after cluster is ready
        // See: k8s/application.yaml for ArgoCD configuration
        // Use: kubectl apply -f k8s/application.yaml after cluster creation

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

        new TerraformOutput(this, "aks_name", {
            value: aks.name,
            description: "Azure Kubernetes Service cluster name",
        });

        new TerraformOutput(this, "kube_config", {
            value: aks.kubeConfigRaw,
            sensitive: true,
            description: "Kubernetes cluster kubeconfig",
        });

        new TerraformOutput(this, "postgresql_fqdn", {
            value: pgServer.fqdn,
            description: "PostgreSQL server FQDN",
        });

        new TerraformOutput(this, "resource_group_name", {
            value: rg.name,
            description: "Azure Resource Group name",
        });
    }
}

const app = new App();
const stack = new MyStack(app, "recipebox-infra");
new AzurermBackend(stack, {
    resourceGroupName: "rg-recipebox-dev",
    storageAccountName: "recipeboxtfstate",
    containerName: "tfstate",
    key: "recipebox-infra.tfstate",
});
app.synth();