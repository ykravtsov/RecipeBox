"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
// Load environment variables from .env file
dotenv.config();
const cdktf_1 = require("cdktf");
const provider_1 = require("@cdktf/provider-azurerm/lib/provider");
const resource_group_1 = require("@cdktf/provider-azurerm/lib/resource-group");
const container_registry_1 = require("@cdktf/provider-azurerm/lib/container-registry");
const kubernetes_cluster_1 = require("@cdktf/provider-azurerm/lib/kubernetes-cluster");
const role_assignment_1 = require("@cdktf/provider-azurerm/lib/role-assignment");
const provider_2 = require("@cdktf/provider-kubernetes/lib/provider");
const provider_3 = require("@cdktf/provider-helm/lib/provider");
const namespace_1 = require("@cdktf/provider-kubernetes/lib/namespace");
const release_1 = require("@cdktf/provider-helm/lib/release");
const postgresql_flexible_server_1 = require("@cdktf/provider-azurerm/lib/postgresql-flexible-server");
const postgresql_flexible_server_database_1 = require("@cdktf/provider-azurerm/lib/postgresql-flexible-server-database");
const postgresql_flexible_server_firewall_rule_1 = require("@cdktf/provider-azurerm/lib/postgresql-flexible-server-firewall-rule");
const storage_account_1 = require("@cdktf/provider-azurerm/lib/storage-account");
const cdn_profile_1 = require("@cdktf/provider-azurerm/lib/cdn-profile");
const cdn_endpoint_1 = require("@cdktf/provider-azurerm/lib/cdn-endpoint");
const key_vault_1 = require("@cdktf/provider-azurerm/lib/key-vault");
const key_vault_secret_1 = require("@cdktf/provider-azurerm/lib/key-vault-secret");
const data_azurerm_client_config_1 = require("@cdktf/provider-azurerm/lib/data-azurerm-client-config");
const ENV = process.env.ENVIRONMENT || "dev";
const environmentConfigs = {
    dev: {
        name: "dev",
        location: "West US 2",
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
        location: "West US 2",
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
        location: "West US 2",
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
class MyStack extends cdktf_1.TerraformStack {
    constructor(scope, id) {
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
        new provider_1.AzurermProvider(this, "AzureRm", {
            features: [{}],
            subscriptionId: azureCreds.subscriptionId,
            tenantId: azureCreds.tenantId,
            clientId: azureCreds.clientId,
            clientSecret: azureCreds.clientSecret,
        });
        // Get current Azure client configuration for Key Vault access policies
        const currentClientConfig = new data_azurerm_client_config_1.DataAzurermClientConfig(this, "current-config", {});
        const rg = new resource_group_1.ResourceGroup(this, "rg", {
            name: `rg-recipebox-${config.name}`,
            location: config.location,
            tags: config.tags,
        });
        // Azure Key Vault for secrets management
        const keyVault = new key_vault_1.KeyVault(this, "keyvault", {
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
        new key_vault_secret_1.KeyVaultSecret(this, "pg-password-secret", {
            name: "postgres-password",
            value: pgPassword,
            keyVaultId: keyVault.id,
        });
        const acr = new container_registry_1.ContainerRegistry(this, "acr", {
            name: `recipeboxacr${config.name}`,
            resourceGroupName: rg.name,
            location: rg.location,
            sku: config.acrSku,
            adminEnabled: true,
            tags: config.tags,
        });
        const storageAccount = new storage_account_1.StorageAccount(this, "storage", {
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
        const cdnProfile = new cdn_profile_1.CdnProfile(this, "cdnProfile", {
            name: `recipebox-cdn-${config.name}`,
            location: "Global",
            resourceGroupName: rg.name,
            sku: config.cdnSku,
            tags: config.tags,
        });
        const cdnEndpoint = new cdn_endpoint_1.CdnEndpoint(this, "cdnEndpoint", {
            name: `recipebox-frontend-${config.name}`,
            profileName: cdnProfile.name,
            location: "Global",
            resourceGroupName: rg.name,
            origin: [{
                    name: "recipebox-origin",
                    hostName: storageAccount.primaryWebHost,
                }],
            tags: config.tags,
        });
        const pgServer = new postgresql_flexible_server_1.PostgresqlFlexibleServer(this, "pgServer", {
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
        new postgresql_flexible_server_database_1.PostgresqlFlexibleServerDatabase(this, "pgDb", {
            name: "recipebox",
            serverId: pgServer.id,
        });
        // PostgreSQL Firewall Rules for secure client access
        // Allow Azure Services to access PostgreSQL
        new postgresql_flexible_server_firewall_rule_1.PostgresqlFlexibleServerFirewallRule(this, "pg-allow-azure-services", {
            name: "AllowAzureServices",
            serverId: pgServer.id,
            startIpAddress: "0.0.0.0",
            endIpAddress: "0.0.0.0",
        });
        // Allow AKS to access PostgreSQL (optional: restrict to specific IPs if available)
        // Note: In production, use a private endpoint instead of firewall rules
        new postgresql_flexible_server_firewall_rule_1.PostgresqlFlexibleServerFirewallRule(this, "pg-allow-aks", {
            name: "AllowAKS",
            serverId: pgServer.id,
            startIpAddress: "10.0.0.0",
            endIpAddress: "10.255.255.255",
        });
        const aks = new kubernetes_cluster_1.KubernetesCluster(this, "aks", {
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
        new role_assignment_1.RoleAssignment(this, "acrPull", {
            scope: acr.id,
            roleDefinitionName: "AcrPull",
            principalId: aks.kubeletIdentity.objectId,
            dependsOn: [aks],
        });
        // Kubernetes provider
        new provider_2.KubernetesProvider(this, "k8s", {
            host: aks.kubeConfig.get(0).host,
            clientCertificate: aks.kubeConfig.get(0).clientCertificate,
            clientKey: aks.kubeConfig.get(0).clientKey,
            clusterCaCertificate: aks.kubeConfig.get(0).clusterCaCertificate,
            insecure: false,
        });
        // Helm provider
        new provider_3.HelmProvider(this, "helm", {
            kubernetes: {
                host: aks.kubeConfig.get(0).host,
                clientCertificate: aks.kubeConfig.get(0).clientCertificate,
                clientKey: aks.kubeConfig.get(0).clientKey,
                clusterCaCertificate: aks.kubeConfig.get(0).clusterCaCertificate,
            },
        });
        // ArgoCD namespace
        new namespace_1.Namespace(this, "argocd-ns", {
            metadata: {
                name: "argocd",
            },
        });
        // ArgoCD Helm release
        new release_1.Release(this, "argocd", {
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
        new cdktf_1.TerraformOutput(this, "environment", {
            value: config.name,
            description: "Deployed environment name",
        });
        new cdktf_1.TerraformOutput(this, "acr_login_server", {
            value: acr.loginServer,
            description: "Azure Container Registry login server",
        });
        new cdktf_1.TerraformOutput(this, "acr_name", {
            value: acr.name,
            description: "Azure Container Registry name",
        });
        new cdktf_1.TerraformOutput(this, "kube_config", {
            value: aks.kubeConfigRaw,
            sensitive: true,
            description: "Kubernetes cluster kubeconfig",
        });
        new cdktf_1.TerraformOutput(this, "cdn_endpoint", {
            value: cdnEndpoint.fqdn,
            description: "CDN endpoint FQDN for static frontend",
        });
        new cdktf_1.TerraformOutput(this, "storage_account_name", {
            value: storageAccount.name,
            description: "Storage account name for frontend deployment",
        });
        new cdktf_1.TerraformOutput(this, "postgresql_fqdn", {
            value: pgServer.fqdn,
            description: "PostgreSQL server FQDN",
        });
        new cdktf_1.TerraformOutput(this, "key_vault_id", {
            value: keyVault.id,
            description: "Key Vault ID for secrets management",
        });
        new cdktf_1.TerraformOutput(this, "resource_group_name", {
            value: rg.name,
            description: "Azure Resource Group name",
        });
    }
}
const app = new cdktf_1.App();
new MyStack(app, "recipebox-infra");
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsNENBQTRDO0FBQzVDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUdoQixpQ0FBNkQ7QUFDN0QsbUVBQXVFO0FBQ3ZFLCtFQUEyRTtBQUMzRSx1RkFBbUY7QUFDbkYsdUZBQW1GO0FBQ25GLGlGQUE2RTtBQUM3RSxzRUFBNkU7QUFDN0UsZ0VBQWlFO0FBQ2pFLHdFQUFxRTtBQUNyRSw4REFBMkQ7QUFDM0QsdUdBQWtHO0FBQ2xHLHlIQUFtSDtBQUNuSCxtSUFBNEg7QUFDNUgsaUZBQTZFO0FBQzdFLHlFQUFxRTtBQUNyRSwyRUFBdUU7QUFDdkUscUVBQWlFO0FBQ2pFLG1GQUE4RTtBQUM5RSx1R0FBaUc7QUFvQmpHLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQztBQUU3QyxNQUFNLGtCQUFrQixHQUFzQztJQUM1RCxHQUFHLEVBQUU7UUFDSCxJQUFJLEVBQUUsS0FBSztRQUNYLFFBQVEsRUFBRSxXQUFXO1FBQ3JCLE1BQU0sRUFBRSxPQUFPO1FBQ2YsWUFBWSxFQUFFLENBQUM7UUFDZixTQUFTLEVBQUUsaUJBQWlCO1FBQzVCLFNBQVMsRUFBRSxpQkFBaUI7UUFDNUIsV0FBVyxFQUFFLEtBQUs7UUFDbEIsa0JBQWtCLEVBQUUsVUFBVTtRQUM5Qix5QkFBeUIsRUFBRSxLQUFLO1FBQ2hDLE1BQU0sRUFBRSxvQkFBb0I7UUFDNUIsSUFBSSxFQUFFO1lBQ0osV0FBVyxFQUFFLEtBQUs7WUFDbEIsU0FBUyxFQUFFLFdBQVc7WUFDdEIsVUFBVSxFQUFFLGFBQWE7U0FDMUI7S0FDRjtJQUNELE9BQU8sRUFBRTtRQUNQLElBQUksRUFBRSxTQUFTO1FBQ2YsUUFBUSxFQUFFLFdBQVc7UUFDckIsTUFB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LEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZG90ZW52IGZyb20gXCJkb3RlbnZcIjtcblxuLy8gTG9hZCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZnJvbSAuZW52IGZpbGVcbmRvdGVudi5jb25maWcoKTtcblxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcbmltcG9ydCB7IEFwcCwgVGVycmFmb3JtU3RhY2ssIFRlcnJhZm9ybU91dHB1dCB9IGZyb20gXCJjZGt0ZlwiO1xuaW1wb3J0IHsgQXp1cmVybVByb3ZpZGVyIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9wcm92aWRlclwiO1xuaW1wb3J0IHsgUmVzb3VyY2VHcm91cCB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcmVzb3VyY2UtZ3JvdXBcIjtcbmltcG9ydCB7IENvbnRhaW5lclJlZ2lzdHJ5IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9jb250YWluZXItcmVnaXN0cnlcIjtcbmltcG9ydCB7IEt1YmVybmV0ZXNDbHVzdGVyIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9rdWJlcm5ldGVzLWNsdXN0ZXJcIjtcbmltcG9ydCB7IFJvbGVBc3NpZ25tZW50IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9yb2xlLWFzc2lnbm1lbnRcIjtcbmltcG9ydCB7IEt1YmVybmV0ZXNQcm92aWRlciB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXIta3ViZXJuZXRlcy9saWIvcHJvdmlkZXJcIjtcbmltcG9ydCB7IEhlbG1Qcm92aWRlciB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItaGVsbS9saWIvcHJvdmlkZXJcIjtcbmltcG9ydCB7IE5hbWVzcGFjZSB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXIta3ViZXJuZXRlcy9saWIvbmFtZXNwYWNlXCI7XG5pbXBvcnQgeyBSZWxlYXNlIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1oZWxtL2xpYi9yZWxlYXNlXCI7XG5pbXBvcnQgeyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXIgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3Bvc3RncmVzcWwtZmxleGlibGUtc2VydmVyXCI7XG5pbXBvcnQgeyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJEYXRhYmFzZSB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcG9zdGdyZXNxbC1mbGV4aWJsZS1zZXJ2ZXItZGF0YWJhc2VcIjtcbmltcG9ydCB7IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlckZpcmV3YWxsUnVsZSB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcG9zdGdyZXNxbC1mbGV4aWJsZS1zZXJ2ZXItZmlyZXdhbGwtcnVsZVwiO1xuaW1wb3J0IHsgU3RvcmFnZUFjY291bnQgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3N0b3JhZ2UtYWNjb3VudFwiO1xuaW1wb3J0IHsgQ2RuUHJvZmlsZSB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvY2RuLXByb2ZpbGVcIjtcbmltcG9ydCB7IENkbkVuZHBvaW50IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9jZG4tZW5kcG9pbnRcIjtcbmltcG9ydCB7IEtleVZhdWx0IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9rZXktdmF1bHRcIjtcbmltcG9ydCB7IEtleVZhdWx0U2VjcmV0IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9rZXktdmF1bHQtc2VjcmV0XCI7XG5pbXBvcnQgeyBEYXRhQXp1cmVybUNsaWVudENvbmZpZyB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvZGF0YS1henVyZXJtLWNsaWVudC1jb25maWdcIjtcblxuLyoqXG4gKiBFbnZpcm9ubWVudCBDb25maWd1cmF0aW9uXG4gKiBBZGp1c3QgdGhlc2UgdmFsdWVzIGZvciBkaWZmZXJlbnQgZW52aXJvbm1lbnRzIChkZXYsIHN0YWdpbmcsIHByb2QpXG4gKi9cbmludGVyZmFjZSBFbnZpcm9ubWVudENvbmZpZyB7XG4gIG5hbWU6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgYWNyU2t1OiBzdHJpbmc7XG4gIGFrc05vZGVDb3VudDogbnVtYmVyO1xuICBha3NWbVNpemU6IHN0cmluZztcbiAgcGdTa3VOYW1lOiBzdHJpbmc7XG4gIHBnU3RvcmFnZU1iOiBudW1iZXI7XG4gIHN0b3JhZ2VBY2NvdW50VGllcjogc3RyaW5nO1xuICBzdG9yYWdlQWNjb3VudFJlcGxpY2F0aW9uOiBzdHJpbmc7XG4gIGNkblNrdTogc3RyaW5nO1xuICB0YWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5jb25zdCBFTlYgPSBwcm9jZXNzLmVudi5FTlZJUk9OTUVOVCB8fCBcImRldlwiO1xuXG5jb25zdCBlbnZpcm9ubWVudENvbmZpZ3M6IFJlY29yZDxzdHJpbmcsIEVudmlyb25tZW50Q29uZmlnPiA9IHtcbiAgZGV2OiB7XG4gICAgbmFtZTogXCJkZXZcIixcbiAgICBsb2NhdGlvbjogXCJXZXN0IFVTIDJcIixcbiAgICBhY3JTa3U6IFwiQmFzaWNcIixcbiAgICBha3NOb2RlQ291bnQ6IDEsXG4gICAgYWtzVm1TaXplOiBcIlN0YW5kYXJkX0RTMl92MlwiLFxuICAgIHBnU2t1TmFtZTogXCJCX1N0YW5kYXJkX0IxbXNcIixcbiAgICBwZ1N0b3JhZ2VNYjogMzI3NjgsXG4gICAgc3RvcmFnZUFjY291bnRUaWVyOiBcIlN0YW5kYXJkXCIsXG4gICAgc3RvcmFnZUFjY291bnRSZXBsaWNhdGlvbjogXCJMUlNcIixcbiAgICBjZG5Ta3U6IFwiU3RhbmRhcmRfTWljcm9zb2Z0XCIsXG4gICAgdGFnczoge1xuICAgICAgRW52aXJvbm1lbnQ6IFwiZGV2XCIsXG4gICAgICBNYW5hZ2VkQnk6IFwiVGVycmFmb3JtXCIsXG4gICAgICBDb3N0Q2VudGVyOiBcImRldmVsb3BtZW50XCIsXG4gICAgfSxcbiAgfSxcbiAgc3RhZ2luZzoge1xuICAgIG5hbWU6IFwic3RhZ2luZ1wiLFxuICAgIGxvY2F0aW9uOiBcIldlc3QgVVMgMlwiLFxuICAgIGFjclNrdTogXCJTdGFuZGFyZFwiLFxuICAgIGFrc05vZGVDb3VudDogMixcbiAgICBha3NWbVNpemU6IFwiU3RhbmRhcmRfRFMzX3YyXCIsXG4gICAgcGdTa3VOYW1lOiBcIkdQX1N0YW5kYXJkX0Qyc192M1wiLFxuICAgIHBnU3RvcmFnZU1iOiA2NTUzNixcbiAgICBzdG9yYWdlQWNjb3VudFRpZXI6IFwiU3RhbmRhcmRcIixcbiAgICBzdG9yYWdlQWNjb3VudFJlcGxpY2F0aW9uOiBcIkdSU1wiLFxuICAgIGNkblNrdTogXCJTdGFuZGFyZF9NaWNyb3NvZnRcIixcbiAgICB0YWdzOiB7XG4gICAgICBFbnZpcm9ubWVudDogXCJzdGFnaW5nXCIsXG4gICAgICBNYW5hZ2VkQnk6IFwiVGVycmFmb3JtXCIsXG4gICAgICBDb3N0Q2VudGVyOiBcInN0YWdpbmdcIixcbiAgICB9LFxuICB9LFxuICBwcm9kOiB7XG4gICAgbmFtZTogXCJwcm9kXCIsXG4gICAgbG9jYXRpb246IFwiV2VzdCBVUyAyXCIsXG4gICAgYWNyU2t1OiBcIlByZW1pdW1cIixcbiAgICBha3NOb2RlQ291bnQ6IDMsXG4gICAgYWtzVm1TaXplOiBcIlN0YW5kYXJkX0RTM192MlwiLFxuICAgIHBnU2t1TmFtZTogXCJHUF9TdGFuZGFyZF9ENHNfdjNcIixcbiAgICBwZ1N0b3JhZ2VNYjogMTMxMDcyLFxuICAgIHN0b3JhZ2VBY2NvdW50VGllcjogXCJQcmVtaXVtXCIsXG4gICAgc3RvcmFnZUFjY291bnRSZXBsaWNhdGlvbjogXCJHUlNcIixcbiAgICBjZG5Ta3U6IFwiUHJlbWl1bV9NaWNyb3NvZnRcIixcbiAgICB0YWdzOiB7XG4gICAgICBFbnZpcm9ubWVudDogXCJwcm9kXCIsXG4gICAgICBNYW5hZ2VkQnk6IFwiVGVycmFmb3JtXCIsXG4gICAgICBDb3N0Q2VudGVyOiBcInByb2R1Y3Rpb25cIixcbiAgICB9LFxuICB9LFxufTtcblxuY29uc3QgY29uZmlnID0gZW52aXJvbm1lbnRDb25maWdzW0VOVl0gfHwgZW52aXJvbm1lbnRDb25maWdzLmRldjtcblxuLy8gRm9yY2UgaW5pdGlhbCBidWlsZCB0cmlnZ2VyXG5cbmNsYXNzIE15U3RhY2sgZXh0ZW5kcyBUZXJyYWZvcm1TdGFjayB7XG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIC8vIFJFUVVJUkVEIEdJVEhVQiBTRUNSRVRTIChzZXQgdGhlc2UgYmVmb3JlIGRlcGxveW1lbnQpOlxuICAgICAgICAvLyAtIEFaVVJFX0NSRURFTlRJQUxTOiBKU09OIG9iamVjdCB3aXRoIHN1YnNjcmlwdGlvbklkLCB0ZW5hbnRJZCwgY2xpZW50SWQsIGNsaWVudFNlY3JldFxuICAgICAgICAvLyAtIFBPU1RHUkVTX1BBU1NXT1JEOiBTdHJvbmcgcGFzc3dvcmQgKG1pbiA4IGNoYXJzLCBtdXN0IGluY2x1ZGUgdXBwZXJjYXNlLCBsb3dlcmNhc2UsIG51bWJlciwgc3BlY2lhbCBjaGFyKVxuICAgICAgICAvLyAtIEdJVEhVQl9SRVBPU0lUT1JZX1VSTDogRnVsbCBVUkwgdG8gR2l0SHViIHJlcG9zaXRvcnlcblxuICAgICAgICAvLyBHZXQgY29uZmlndXJhdGlvbiBmcm9tIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgICAgICBjb25zdCByZXBvVXJsID0gcHJvY2Vzcy5lbnYuR0lUSFVCX1JFUE9TSVRPUllfVVJMIHx8IFwiaHR0cHM6Ly9naXRodWIuY29tL3lvdXItb3JnL3JlY2lwZWJveFwiO1xuICAgICAgICBjb25zdCBwZ1Bhc3N3b3JkID0gcHJvY2Vzcy5lbnYuUE9TVEdSRVNfUEFTU1dPUkQ7XG4gICAgICAgIGlmICghcGdQYXNzd29yZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUE9TVEdSRVNfUEFTU1dPUkQgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgcmVxdWlyZWRcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYXp1cmVDcmVkcyA9IEpTT04ucGFyc2UocHJvY2Vzcy5lbnYuQVpVUkVfQ1JFREVOVElBTFMgfHwgJ3tcInN1YnNjcmlwdGlvbklkXCI6XCJcIixcInRlbmFudElkXCI6XCJcIixcImNsaWVudElkXCI6XCJcIixcImNsaWVudFNlY3JldFwiOlwiXCJ9Jyk7XG5cbiAgICAgICAgbmV3IEF6dXJlcm1Qcm92aWRlcih0aGlzLCBcIkF6dXJlUm1cIiwge1xuICAgICAgICAgICAgZmVhdHVyZXM6IFt7fV0sXG4gICAgICAgICAgICBzdWJzY3JpcHRpb25JZDogYXp1cmVDcmVkcy5zdWJzY3JpcHRpb25JZCxcbiAgICAgICAgICAgIHRlbmFudElkOiBhenVyZUNyZWRzLnRlbmFudElkLFxuICAgICAgICAgICAgY2xpZW50SWQ6IGF6dXJlQ3JlZHMuY2xpZW50SWQsXG4gICAgICAgICAgICBjbGllbnRTZWNyZXQ6IGF6dXJlQ3JlZHMuY2xpZW50U2VjcmV0LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBHZXQgY3VycmVudCBBenVyZSBjbGllbnQgY29uZmlndXJhdGlvbiBmb3IgS2V5IFZhdWx0IGFjY2VzcyBwb2xpY2llc1xuICAgICAgICBjb25zdCBjdXJyZW50Q2xpZW50Q29uZmlnID0gbmV3IERhdGFBenVyZXJtQ2xpZW50Q29uZmlnKHRoaXMsIFwiY3VycmVudC1jb25maWdcIiwge30pO1xuXG4gICAgICAgIGNvbnN0IHJnID0gbmV3IFJlc291cmNlR3JvdXAodGhpcywgXCJyZ1wiLCB7XG4gICAgICAgICAgICBuYW1lOiBgcmctcmVjaXBlYm94LSR7Y29uZmlnLm5hbWV9YCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiBjb25maWcubG9jYXRpb24sXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQXp1cmUgS2V5IFZhdWx0IGZvciBzZWNyZXRzIG1hbmFnZW1lbnRcbiAgICAgICAgY29uc3Qga2V5VmF1bHQgPSBuZXcgS2V5VmF1bHQodGhpcywgXCJrZXl2YXVsdFwiLCB7XG4gICAgICAgICAgICBuYW1lOiBgcmVjaXBlYm94LWt2LSR7Y29uZmlnLm5hbWV9YCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHJlc291cmNlR3JvdXBOYW1lOiByZy5uYW1lLFxuICAgICAgICAgICAgdGVuYW50SWQ6IGF6dXJlQ3JlZHMudGVuYW50SWQsXG4gICAgICAgICAgICBza3VOYW1lOiBcInN0YW5kYXJkXCIsXG4gICAgICAgICAgICBlbmFibGVkRm9yRGVwbG95bWVudDogdHJ1ZSxcbiAgICAgICAgICAgIGVuYWJsZWRGb3JEaXNrRW5jcnlwdGlvbjogZmFsc2UsXG4gICAgICAgICAgICBlbmFibGVkRm9yVGVtcGxhdGVEZXBsb3ltZW50OiB0cnVlLFxuICAgICAgICAgICAgYWNjZXNzUG9saWN5OiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0ZW5hbnRJZDogYXp1cmVDcmVkcy50ZW5hbnRJZCxcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0SWQ6IGN1cnJlbnRDbGllbnRDb25maWcub2JqZWN0SWQsXG4gICAgICAgICAgICAgICAgICAgIGtleVBlcm1pc3Npb25zOiBbXCJHZXRcIiwgXCJMaXN0XCIsIFwiQ3JlYXRlXCIsIFwiRGVsZXRlXCIsIFwiVXBkYXRlXCJdLFxuICAgICAgICAgICAgICAgICAgICBzZWNyZXRQZXJtaXNzaW9uczogW1wiR2V0XCIsIFwiTGlzdFwiLCBcIlNldFwiLCBcIkRlbGV0ZVwiXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTdG9yZSBQb3N0Z3JlU1FMIHBhc3N3b3JkIGluIEtleSBWYXVsdFxuICAgICAgICBuZXcgS2V5VmF1bHRTZWNyZXQodGhpcywgXCJwZy1wYXNzd29yZC1zZWNyZXRcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJwb3N0Z3Jlcy1wYXNzd29yZFwiLFxuICAgICAgICAgICAgdmFsdWU6IHBnUGFzc3dvcmQsXG4gICAgICAgICAgICBrZXlWYXVsdElkOiBrZXlWYXVsdC5pZCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgYWNyID0gbmV3IENvbnRhaW5lclJlZ2lzdHJ5KHRoaXMsIFwiYWNyXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IGByZWNpcGVib3hhY3Ike2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHNrdTogY29uZmlnLmFjclNrdSxcbiAgICAgICAgICAgIGFkbWluRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBzdG9yYWdlQWNjb3VudCA9IG5ldyBTdG9yYWdlQWNjb3VudCh0aGlzLCBcInN0b3JhZ2VcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveCR7Y29uZmlnLm5hbWV9c3RvcmFnZWAsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIGFjY291bnRUaWVyOiBjb25maWcuc3RvcmFnZUFjY291bnRUaWVyLFxuICAgICAgICAgICAgYWNjb3VudFJlcGxpY2F0aW9uVHlwZTogY29uZmlnLnN0b3JhZ2VBY2NvdW50UmVwbGljYXRpb24sXG4gICAgICAgICAgICBzdGF0aWNXZWJzaXRlOiB7XG4gICAgICAgICAgICAgICAgaW5kZXhEb2N1bWVudDogXCJpbmRleC5odG1sXCIsXG4gICAgICAgICAgICAgICAgZXJyb3I0MDREb2N1bWVudDogXCJpbmRleC5odG1sXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGFnczogY29uZmlnLnRhZ3MsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNkblByb2ZpbGUgPSBuZXcgQ2RuUHJvZmlsZSh0aGlzLCBcImNkblByb2ZpbGVcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1jZG4tJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgbG9jYXRpb246IFwiR2xvYmFsXCIsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIHNrdTogY29uZmlnLmNkblNrdSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBjZG5FbmRwb2ludCA9IG5ldyBDZG5FbmRwb2ludCh0aGlzLCBcImNkbkVuZHBvaW50XCIsIHtcbiAgICAgICAgICAgIG5hbWU6IGByZWNpcGVib3gtZnJvbnRlbmQtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgcHJvZmlsZU5hbWU6IGNkblByb2ZpbGUubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiBcIkdsb2JhbFwiLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBvcmlnaW46IFt7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJyZWNpcGVib3gtb3JpZ2luXCIsXG4gICAgICAgICAgICAgICAgaG9zdE5hbWU6IHN0b3JhZ2VBY2NvdW50LnByaW1hcnlXZWJIb3N0LFxuICAgICAgICAgICAgfV0sXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcGdTZXJ2ZXIgPSBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyKHRoaXMsIFwicGdTZXJ2ZXJcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1wZy0ke2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHNrdU5hbWU6IGNvbmZpZy5wZ1NrdU5hbWUsXG4gICAgICAgICAgICBzdG9yYWdlTWI6IGNvbmZpZy5wZ1N0b3JhZ2VNYixcbiAgICAgICAgICAgIHZlcnNpb246IFwiMTVcIixcbiAgICAgICAgICAgIGFkbWluaXN0cmF0b3JMb2dpbjogXCJwZ2FkbWluXCIsXG4gICAgICAgICAgICBhZG1pbmlzdHJhdG9yUGFzc3dvcmQ6IHBnUGFzc3dvcmQsXG4gICAgICAgICAgICB6b25lOiBcIjFcIixcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyRGF0YWJhc2UodGhpcywgXCJwZ0RiXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IFwicmVjaXBlYm94XCIsXG4gICAgICAgICAgICBzZXJ2ZXJJZDogcGdTZXJ2ZXIuaWQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFBvc3RncmVTUUwgRmlyZXdhbGwgUnVsZXMgZm9yIHNlY3VyZSBjbGllbnQgYWNjZXNzXG4gICAgICAgIC8vIEFsbG93IEF6dXJlIFNlcnZpY2VzIHRvIGFjY2VzcyBQb3N0Z3JlU1FMXG4gICAgICAgIG5ldyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJGaXJld2FsbFJ1bGUodGhpcywgXCJwZy1hbGxvdy1henVyZS1zZXJ2aWNlc1wiLCB7XG4gICAgICAgICAgICBuYW1lOiBcIkFsbG93QXp1cmVTZXJ2aWNlc1wiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICAgICAgc3RhcnRJcEFkZHJlc3M6IFwiMC4wLjAuMFwiLFxuICAgICAgICAgICAgZW5kSXBBZGRyZXNzOiBcIjAuMC4wLjBcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWxsb3cgQUtTIHRvIGFjY2VzcyBQb3N0Z3JlU1FMIChvcHRpb25hbDogcmVzdHJpY3QgdG8gc3BlY2lmaWMgSVBzIGlmIGF2YWlsYWJsZSlcbiAgICAgICAgLy8gTm90ZTogSW4gcHJvZHVjdGlvbiwgdXNlIGEgcHJpdmF0ZSBlbmRwb2ludCBpbnN0ZWFkIG9mIGZpcmV3YWxsIHJ1bGVzXG4gICAgICAgIG5ldyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJGaXJld2FsbFJ1bGUodGhpcywgXCJwZy1hbGxvdy1ha3NcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJBbGxvd0FLU1wiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICAgICAgc3RhcnRJcEFkZHJlc3M6IFwiMTAuMC4wLjBcIixcbiAgICAgICAgICAgIGVuZElwQWRkcmVzczogXCIxMC4yNTUuMjU1LjI1NVwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBha3MgPSBuZXcgS3ViZXJuZXRlc0NsdXN0ZXIodGhpcywgXCJha3NcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1ha3MtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgbG9jYXRpb246IHJnLmxvY2F0aW9uLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBkbnNQcmVmaXg6IGByZWNpcGVib3gtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgZGVmYXVsdE5vZGVQb29sOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJkZWZhdWx0XCIsXG4gICAgICAgICAgICAgICAgbm9kZUNvdW50OiBjb25maWcuYWtzTm9kZUNvdW50LFxuICAgICAgICAgICAgICAgIHZtU2l6ZTogY29uZmlnLmFrc1ZtU2l6ZSxcbiAgICAgICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpZGVudGl0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiU3lzdGVtQXNzaWduZWRcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb2xlQmFzZWRBY2Nlc3NDb250cm9sRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgUm9sZUFzc2lnbm1lbnQodGhpcywgXCJhY3JQdWxsXCIsIHtcbiAgICAgICAgICAgIHNjb3BlOiBhY3IuaWQsXG4gICAgICAgICAgICByb2xlRGVmaW5pdGlvbk5hbWU6IFwiQWNyUHVsbFwiLFxuICAgICAgICAgICAgcHJpbmNpcGFsSWQ6IGFrcy5rdWJlbGV0SWRlbnRpdHkub2JqZWN0SWQsXG4gICAgICAgICAgICBkZXBlbmRzT246IFtha3NdLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBLdWJlcm5ldGVzIHByb3ZpZGVyXG4gICAgICAgIG5ldyBLdWJlcm5ldGVzUHJvdmlkZXIodGhpcywgXCJrOHNcIiwge1xuICAgICAgICAgICAgaG9zdDogYWtzLmt1YmVDb25maWcuZ2V0KDApLmhvc3QsXG4gICAgICAgICAgICBjbGllbnRDZXJ0aWZpY2F0ZTogYWtzLmt1YmVDb25maWcuZ2V0KDApLmNsaWVudENlcnRpZmljYXRlLFxuICAgICAgICAgICAgY2xpZW50S2V5OiBha3Mua3ViZUNvbmZpZy5nZXQoMCkuY2xpZW50S2V5LFxuICAgICAgICAgICAgY2x1c3RlckNhQ2VydGlmaWNhdGU6IGFrcy5rdWJlQ29uZmlnLmdldCgwKS5jbHVzdGVyQ2FDZXJ0aWZpY2F0ZSxcbiAgICAgICAgICAgIGluc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSGVsbSBwcm92aWRlclxuICAgICAgICBuZXcgSGVsbVByb3ZpZGVyKHRoaXMsIFwiaGVsbVwiLCB7XG4gICAgICAgICAgICBrdWJlcm5ldGVzOiB7XG4gICAgICAgICAgICAgICAgaG9zdDogYWtzLmt1YmVDb25maWcuZ2V0KDApLmhvc3QsXG4gICAgICAgICAgICAgICAgY2xpZW50Q2VydGlmaWNhdGU6IGFrcy5rdWJlQ29uZmlnLmdldCgwKS5jbGllbnRDZXJ0aWZpY2F0ZSxcbiAgICAgICAgICAgICAgICBjbGllbnRLZXk6IGFrcy5rdWJlQ29uZmlnLmdldCgwKS5jbGllbnRLZXksXG4gICAgICAgICAgICAgICAgY2x1c3RlckNhQ2VydGlmaWNhdGU6IGFrcy5rdWJlQ29uZmlnLmdldCgwKS5jbHVzdGVyQ2FDZXJ0aWZpY2F0ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFyZ29DRCBuYW1lc3BhY2VcbiAgICAgICAgbmV3IE5hbWVzcGFjZSh0aGlzLCBcImFyZ29jZC1uc1wiLCB7XG4gICAgICAgICAgICBtZXRhZGF0YToge1xuICAgICAgICAgICAgICAgIG5hbWU6IFwiYXJnb2NkXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBcmdvQ0QgSGVsbSByZWxlYXNlXG4gICAgICAgIG5ldyBSZWxlYXNlKHRoaXMsIFwiYXJnb2NkXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IFwiYXJnb2NkXCIsXG4gICAgICAgICAgICByZXBvc2l0b3J5OiBcImh0dHBzOi8vYXJnb3Byb2ouZ2l0aHViLmlvL2FyZ28taGVsbVwiLFxuICAgICAgICAgICAgY2hhcnQ6IFwiYXJnby1jZFwiLFxuICAgICAgICAgICAgbmFtZXNwYWNlOiBcImFyZ29jZFwiLFxuICAgICAgICAgICAgc2V0OiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcInNlcnZlci5zZXJ2aWNlLnR5cGVcIixcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IFwiTG9hZEJhbGFuY2VyXCIsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE5vdGU6IEFyZ29DRCBBcHBsaWNhdGlvbiByZXNvdXJjZXMgYXJlIG1hbmFnZWQgYnkgR2l0T3BzIChpbiBrOHMvYXBwbGljYXRpb24ueWFtbClcbiAgICAgICAgLy8gVGhpcyBhbGxvd3MgQXJnb0NEIHRvIG1hbmFnZSBpdHNlbGYgYW5kIHByZXZlbnRzIHRpbWluZyBpc3N1ZXMgZHVyaW5nIGluaXRpYWwgZGVwbG95bWVudFxuXG4gICAgICAgIC8vIE91dHB1dHNcbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImVudmlyb25tZW50XCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBjb25maWcubmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkRlcGxveWVkIGVudmlyb25tZW50IG5hbWVcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImFjcl9sb2dpbl9zZXJ2ZXJcIiwge1xuICAgICAgICAgICAgdmFsdWU6IGFjci5sb2dpblNlcnZlcixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkF6dXJlIENvbnRhaW5lciBSZWdpc3RyeSBsb2dpbiBzZXJ2ZXJcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImFjcl9uYW1lXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBhY3IubmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkF6dXJlIENvbnRhaW5lciBSZWdpc3RyeSBuYW1lXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJrdWJlX2NvbmZpZ1wiLCB7XG4gICAgICAgICAgICB2YWx1ZTogYWtzLmt1YmVDb25maWdSYXcsXG4gICAgICAgICAgICBzZW5zaXRpdmU6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJLdWJlcm5ldGVzIGNsdXN0ZXIga3ViZWNvbmZpZ1wiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwiY2RuX2VuZHBvaW50XCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBjZG5FbmRwb2ludC5mcWRuLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQ0ROIGVuZHBvaW50IEZRRE4gZm9yIHN0YXRpYyBmcm9udGVuZFwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwic3RvcmFnZV9hY2NvdW50X25hbWVcIiwge1xuICAgICAgICAgICAgdmFsdWU6IHN0b3JhZ2VBY2NvdW50Lm5hbWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJTdG9yYWdlIGFjY291bnQgbmFtZSBmb3IgZnJvbnRlbmQgZGVwbG95bWVudFwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwicG9zdGdyZXNxbF9mcWRuXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBwZ1NlcnZlci5mcWRuLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiUG9zdGdyZVNRTCBzZXJ2ZXIgRlFETlwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwia2V5X3ZhdWx0X2lkXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBrZXlWYXVsdC5pZCxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIktleSBWYXVsdCBJRCBmb3Igc2VjcmV0cyBtYW5hZ2VtZW50XCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJyZXNvdXJjZV9ncm91cF9uYW1lXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiByZy5uYW1lLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQXp1cmUgUmVzb3VyY2UgR3JvdXAgbmFtZVwiLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmNvbnN0IGFwcCA9IG5ldyBBcHAoKTtcbm5ldyBNeVN0YWNrKGFwcCwgXCJyZWNpcGVib3gtaW5mcmFcIik7XG5hcHAuc3ludGgoKTsiXX0=