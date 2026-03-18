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
const manifest_1 = require("@cdktf/provider-kubernetes/lib/manifest");
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
            location: rg.location,
            resourceGroupName: rg.name,
            sku: config.cdnSku,
            tags: config.tags,
        });
        const cdnEndpoint = new cdn_endpoint_1.CdnEndpoint(this, "cdnEndpoint", {
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
        });
        // Kubernetes provider
        new provider_2.KubernetesProvider(this, "k8s", {
            host: aks.kubeConfig.get(0).host,
            clientCertificate: aks.kubeConfig.get(0).clientCertificate,
            clientKey: aks.kubeConfig.get(0).clientKey,
            clusterCaCertificate: aks.kubeConfig.get(0).clusterCaCertificate,
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
        // ArgoCD Applications
        const argocdAppNamespace = new namespace_1.Namespace(this, "argocd-apps-ns", {
            metadata: {
                name: "argocd-apps",
            },
        });
        // RecipeBox Backend Application
        new manifest_1.Manifest(this, "recipebox-backend-app", {
            manifest: {
                apiVersion: "argoproj.io/v1alpha1",
                kind: "Application",
                metadata: {
                    name: "recipebox-backend",
                    namespace: "argocd",
                },
                spec: {
                    project: "default",
                    source: {
                        repoURL: repoUrl,
                        path: "k8s",
                        targetRevision: "HEAD",
                        helm: {
                            valueFiles: ["values.yaml"],
                        },
                    },
                    destination: {
                        server: "https://kubernetes.default.svc",
                        namespace: "default",
                    },
                    syncPolicy: {
                        automated: {
                            prune: true,
                            selfHeal: true,
                        },
                    },
                },
            },
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsNENBQTRDO0FBQzVDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUdoQixpQ0FBNkQ7QUFDN0QsbUVBQXVFO0FBQ3ZFLCtFQUEyRTtBQUMzRSx1RkFBbUY7QUFDbkYsdUZBQW1GO0FBQ25GLGlGQUE2RTtBQUM3RSxzRUFBNkU7QUFDN0UsZ0VBQWlFO0FBQ2pFLHdFQUFxRTtBQUNyRSw4REFBMkQ7QUFDM0QsdUdBQWtHO0FBQ2xHLHlIQUFtSDtBQUNuSCxtSUFBNEg7QUFDNUgsc0VBQW1FO0FBQ25FLGlGQUE2RTtBQUM3RSx5RUFBcUU7QUFDckUsMkVBQXVFO0FBQ3ZFLHFFQUFpRTtBQUNqRSxtRkFBOEU7QUFDOUUsdUdBQWlHO0FBb0JqRyxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7QUFFN0MsTUFBTSxrQkFBa0IsR0FBc0M7SUFDNUQsR0FBRyxFQUFFO1FBQ0gsSUFBSSxFQUFFLEtBQUs7UUFDWCxRQUFRLEVBQUUsU0FBUztRQUNuQixNQUFNLEVBQUUsT0FBTztRQUNmLFlBQVksRUFBRSxDQUFDO1FBQ2YsU0FBUyxFQUFFLGlCQUFpQjtRQUM1QixTQUFTLEVBQUUsaUJBQWlCO1FBQzVCLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLGtCQUFrQixFQUFFLFVBQVU7UUFDOUIseUJBQXlCLEVBQUUsS0FBSztRQUNoQyxNQUFNLEVBQUUsb0JBQW9CO1FBQzVCLElBQUksRUFBRTtZQUNKLFdBQVcsRUFBRSxLQUFLO1lBQ2xCLFNBQVMsRUFBRSxXQUFXO1lBQ3RCLFVBQVUsRUFBRSxhQUFhO1NBQzFCO0tBQ0Y7SUFDRCxPQUFPLEVBQUU7UUFDUCxJQUFJLEVBQUUsU0FBUztRQUNmLFFBQVEsRUFBRSxT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LEtBQUssRUFBRSxXQUFXLENBQUMsSUFBSTtZQUN2QixXQUFXLEVBQUUsdUNBQXVDO1NBQ3ZELENBQUMsQ0FBQztRQUVILElBQUksdUJBQWUsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxJQUFJO1lBQzFCLFdBQVcsRUFBRSw4Q0FBOEM7U0FDOUQsQ0FBQyxDQUFDO1FBRUgsSUFBSSx1QkFBZSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUk7WUFDcEIsV0FBVyxFQUFFLHdCQUF3QjtTQUN4QyxDQUFDLENBQUM7UUFFSCxJQUFJLHVCQUFlLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsUUFBUSxDQUFDLEVBQUU7WUFDbEIsV0FBVyxFQUFFLHFDQUFxQztTQUNyRCxDQUFDLENBQUM7UUFFSCxJQUFJLHVCQUFlLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSTtZQUNkLFdBQVcsRUFBRSwyQkFBMkI7U0FDM0MsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztDQUNKO0FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxXQUFHLEVBQUUsQ0FBQztBQUN0QixJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUNwQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuXG4vLyBMb2FkIGVudmlyb25tZW50IHZhcmlhYmxlcyBmcm9tIC5lbnYgZmlsZVxuZG90ZW52LmNvbmZpZygpO1xuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0IHsgQXBwLCBUZXJyYWZvcm1TdGFjaywgVGVycmFmb3JtT3V0cHV0IH0gZnJvbSBcImNka3RmXCI7XG5pbXBvcnQgeyBBenVyZXJtUHJvdmlkZXIgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3Byb3ZpZGVyXCI7XG5pbXBvcnQgeyBSZXNvdXJjZUdyb3VwIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9yZXNvdXJjZS1ncm91cFwiO1xuaW1wb3J0IHsgQ29udGFpbmVyUmVnaXN0cnkgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL2NvbnRhaW5lci1yZWdpc3RyeVwiO1xuaW1wb3J0IHsgS3ViZXJuZXRlc0NsdXN0ZXIgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL2t1YmVybmV0ZXMtY2x1c3RlclwiO1xuaW1wb3J0IHsgUm9sZUFzc2lnbm1lbnQgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3JvbGUtYXNzaWdubWVudFwiO1xuaW1wb3J0IHsgS3ViZXJuZXRlc1Byb3ZpZGVyIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1rdWJlcm5ldGVzL2xpYi9wcm92aWRlclwiO1xuaW1wb3J0IHsgSGVsbVByb3ZpZGVyIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1oZWxtL2xpYi9wcm92aWRlclwiO1xuaW1wb3J0IHsgTmFtZXNwYWNlIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1rdWJlcm5ldGVzL2xpYi9uYW1lc3BhY2VcIjtcbmltcG9ydCB7IFJlbGVhc2UgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWhlbG0vbGliL3JlbGVhc2VcIjtcbmltcG9ydCB7IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlciB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcG9zdGdyZXNxbC1mbGV4aWJsZS1zZXJ2ZXJcIjtcbmltcG9ydCB7IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlckRhdGFiYXNlIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9wb3N0Z3Jlc3FsLWZsZXhpYmxlLXNlcnZlci1kYXRhYmFzZVwiO1xuaW1wb3J0IHsgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyRmlyZXdhbGxSdWxlIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9wb3N0Z3Jlc3FsLWZsZXhpYmxlLXNlcnZlci1maXJld2FsbC1ydWxlXCI7XG5pbXBvcnQgeyBNYW5pZmVzdCB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXIta3ViZXJuZXRlcy9saWIvbWFuaWZlc3RcIjtcbmltcG9ydCB7IFN0b3JhZ2VBY2NvdW50IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9zdG9yYWdlLWFjY291bnRcIjtcbmltcG9ydCB7IENkblByb2ZpbGUgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL2Nkbi1wcm9maWxlXCI7XG5pbXBvcnQgeyBDZG5FbmRwb2ludCB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvY2RuLWVuZHBvaW50XCI7XG5pbXBvcnQgeyBLZXlWYXVsdCB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIva2V5LXZhdWx0XCI7XG5pbXBvcnQgeyBLZXlWYXVsdFNlY3JldCB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIva2V5LXZhdWx0LXNlY3JldFwiO1xuaW1wb3J0IHsgRGF0YUF6dXJlcm1DbGllbnRDb25maWcgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL2RhdGEtYXp1cmVybS1jbGllbnQtY29uZmlnXCI7XG5cbi8qKlxuICogRW52aXJvbm1lbnQgQ29uZmlndXJhdGlvblxuICogQWRqdXN0IHRoZXNlIHZhbHVlcyBmb3IgZGlmZmVyZW50IGVudmlyb25tZW50cyAoZGV2LCBzdGFnaW5nLCBwcm9kKVxuICovXG5pbnRlcmZhY2UgRW52aXJvbm1lbnRDb25maWcge1xuICBuYW1lOiBzdHJpbmc7XG4gIGxvY2F0aW9uOiBzdHJpbmc7XG4gIGFjclNrdTogc3RyaW5nO1xuICBha3NOb2RlQ291bnQ6IG51bWJlcjtcbiAgYWtzVm1TaXplOiBzdHJpbmc7XG4gIHBnU2t1TmFtZTogc3RyaW5nO1xuICBwZ1N0b3JhZ2VNYjogbnVtYmVyO1xuICBzdG9yYWdlQWNjb3VudFRpZXI6IHN0cmluZztcbiAgc3RvcmFnZUFjY291bnRSZXBsaWNhdGlvbjogc3RyaW5nO1xuICBjZG5Ta3U6IHN0cmluZztcbiAgdGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbn1cblxuY29uc3QgRU5WID0gcHJvY2Vzcy5lbnYuRU5WSVJPTk1FTlQgfHwgXCJkZXZcIjtcblxuY29uc3QgZW52aXJvbm1lbnRDb25maWdzOiBSZWNvcmQ8c3RyaW5nLCBFbnZpcm9ubWVudENvbmZpZz4gPSB7XG4gIGRldjoge1xuICAgIG5hbWU6IFwiZGV2XCIsXG4gICAgbG9jYXRpb246IFwiRWFzdCBVU1wiLFxuICAgIGFjclNrdTogXCJCYXNpY1wiLFxuICAgIGFrc05vZGVDb3VudDogMSxcbiAgICBha3NWbVNpemU6IFwiU3RhbmRhcmRfRFMyX3YyXCIsXG4gICAgcGdTa3VOYW1lOiBcIkJfU3RhbmRhcmRfQjFtc1wiLFxuICAgIHBnU3RvcmFnZU1iOiAzMjc2OCxcbiAgICBzdG9yYWdlQWNjb3VudFRpZXI6IFwiU3RhbmRhcmRcIixcbiAgICBzdG9yYWdlQWNjb3VudFJlcGxpY2F0aW9uOiBcIkxSU1wiLFxuICAgIGNkblNrdTogXCJTdGFuZGFyZF9NaWNyb3NvZnRcIixcbiAgICB0YWdzOiB7XG4gICAgICBFbnZpcm9ubWVudDogXCJkZXZcIixcbiAgICAgIE1hbmFnZWRCeTogXCJUZXJyYWZvcm1cIixcbiAgICAgIENvc3RDZW50ZXI6IFwiZGV2ZWxvcG1lbnRcIixcbiAgICB9LFxuICB9LFxuICBzdGFnaW5nOiB7XG4gICAgbmFtZTogXCJzdGFnaW5nXCIsXG4gICAgbG9jYXRpb246IFwiRWFzdCBVU1wiLFxuICAgIGFjclNrdTogXCJTdGFuZGFyZFwiLFxuICAgIGFrc05vZGVDb3VudDogMixcbiAgICBha3NWbVNpemU6IFwiU3RhbmRhcmRfRFMzX3YyXCIsXG4gICAgcGdTa3VOYW1lOiBcIkdQX1N0YW5kYXJkX0Qyc192M1wiLFxuICAgIHBnU3RvcmFnZU1iOiA2NTUzNixcbiAgICBzdG9yYWdlQWNjb3VudFRpZXI6IFwiU3RhbmRhcmRcIixcbiAgICBzdG9yYWdlQWNjb3VudFJlcGxpY2F0aW9uOiBcIkdSU1wiLFxuICAgIGNkblNrdTogXCJTdGFuZGFyZF9NaWNyb3NvZnRcIixcbiAgICB0YWdzOiB7XG4gICAgICBFbnZpcm9ubWVudDogXCJzdGFnaW5nXCIsXG4gICAgICBNYW5hZ2VkQnk6IFwiVGVycmFmb3JtXCIsXG4gICAgICBDb3N0Q2VudGVyOiBcInN0YWdpbmdcIixcbiAgICB9LFxuICB9LFxuICBwcm9kOiB7XG4gICAgbmFtZTogXCJwcm9kXCIsXG4gICAgbG9jYXRpb246IFwiRWFzdCBVU1wiLFxuICAgIGFjclNrdTogXCJQcmVtaXVtXCIsXG4gICAgYWtzTm9kZUNvdW50OiAzLFxuICAgIGFrc1ZtU2l6ZTogXCJTdGFuZGFyZF9EUzNfdjJcIixcbiAgICBwZ1NrdU5hbWU6IFwiR1BfU3RhbmRhcmRfRDRzX3YzXCIsXG4gICAgcGdTdG9yYWdlTWI6IDEzMTA3MixcbiAgICBzdG9yYWdlQWNjb3VudFRpZXI6IFwiUHJlbWl1bVwiLFxuICAgIHN0b3JhZ2VBY2NvdW50UmVwbGljYXRpb246IFwiR1JTXCIsXG4gICAgY2RuU2t1OiBcIlByZW1pdW1fTWljcm9zb2Z0XCIsXG4gICAgdGFnczoge1xuICAgICAgRW52aXJvbm1lbnQ6IFwicHJvZFwiLFxuICAgICAgTWFuYWdlZEJ5OiBcIlRlcnJhZm9ybVwiLFxuICAgICAgQ29zdENlbnRlcjogXCJwcm9kdWN0aW9uXCIsXG4gICAgfSxcbiAgfSxcbn07XG5cbmNvbnN0IGNvbmZpZyA9IGVudmlyb25tZW50Q29uZmlnc1tFTlZdIHx8IGVudmlyb25tZW50Q29uZmlncy5kZXY7XG5cbi8vIEZvcmNlIGluaXRpYWwgYnVpbGQgdHJpZ2dlclxuXG5jbGFzcyBNeVN0YWNrIGV4dGVuZHMgVGVycmFmb3JtU3RhY2sge1xuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgICAgICAvLyBSRVFVSVJFRCBHSVRIVUIgU0VDUkVUUyAoc2V0IHRoZXNlIGJlZm9yZSBkZXBsb3ltZW50KTpcbiAgICAgICAgLy8gLSBBWlVSRV9DUkVERU5USUFMUzogSlNPTiBvYmplY3Qgd2l0aCBzdWJzY3JpcHRpb25JZCwgdGVuYW50SWQsIGNsaWVudElkLCBjbGllbnRTZWNyZXRcbiAgICAgICAgLy8gLSBQT1NUR1JFU19QQVNTV09SRDogU3Ryb25nIHBhc3N3b3JkIChtaW4gOCBjaGFycywgbXVzdCBpbmNsdWRlIHVwcGVyY2FzZSwgbG93ZXJjYXNlLCBudW1iZXIsIHNwZWNpYWwgY2hhcilcbiAgICAgICAgLy8gLSBHSVRIVUJfUkVQT1NJVE9SWV9VUkw6IEZ1bGwgVVJMIHRvIEdpdEh1YiByZXBvc2l0b3J5XG5cbiAgICAgICAgLy8gR2V0IGNvbmZpZ3VyYXRpb24gZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICAgICAgY29uc3QgcmVwb1VybCA9IHByb2Nlc3MuZW52LkdJVEhVQl9SRVBPU0lUT1JZX1VSTCB8fCBcImh0dHBzOi8vZ2l0aHViLmNvbS95b3VyLW9yZy9yZWNpcGVib3hcIjtcbiAgICAgICAgY29uc3QgcGdQYXNzd29yZCA9IHByb2Nlc3MuZW52LlBPU1RHUkVTX1BBU1NXT1JEO1xuICAgICAgICBpZiAoIXBnUGFzc3dvcmQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlBPU1RHUkVTX1BBU1NXT1JEIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHJlcXVpcmVkXCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGF6dXJlQ3JlZHMgPSBKU09OLnBhcnNlKHByb2Nlc3MuZW52LkFaVVJFX0NSRURFTlRJQUxTIHx8ICd7XCJzdWJzY3JpcHRpb25JZFwiOlwiXCIsXCJ0ZW5hbnRJZFwiOlwiXCIsXCJjbGllbnRJZFwiOlwiXCIsXCJjbGllbnRTZWNyZXRcIjpcIlwifScpO1xuXG4gICAgICAgIG5ldyBBenVyZXJtUHJvdmlkZXIodGhpcywgXCJBenVyZVJtXCIsIHtcbiAgICAgICAgICAgIGZlYXR1cmVzOiBbe31dLFxuICAgICAgICAgICAgc3Vic2NyaXB0aW9uSWQ6IGF6dXJlQ3JlZHMuc3Vic2NyaXB0aW9uSWQsXG4gICAgICAgICAgICB0ZW5hbnRJZDogYXp1cmVDcmVkcy50ZW5hbnRJZCxcbiAgICAgICAgICAgIGNsaWVudElkOiBhenVyZUNyZWRzLmNsaWVudElkLFxuICAgICAgICAgICAgY2xpZW50U2VjcmV0OiBhenVyZUNyZWRzLmNsaWVudFNlY3JldCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gR2V0IGN1cnJlbnQgQXp1cmUgY2xpZW50IGNvbmZpZ3VyYXRpb24gZm9yIEtleSBWYXVsdCBhY2Nlc3MgcG9saWNpZXNcbiAgICAgICAgY29uc3QgY3VycmVudENsaWVudENvbmZpZyA9IG5ldyBEYXRhQXp1cmVybUNsaWVudENvbmZpZyh0aGlzLCBcImN1cnJlbnQtY29uZmlnXCIsIHt9KTtcblxuICAgICAgICBjb25zdCByZyA9IG5ldyBSZXNvdXJjZUdyb3VwKHRoaXMsIFwicmdcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJnLXJlY2lwZWJveC0ke2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICBsb2NhdGlvbjogY29uZmlnLmxvY2F0aW9uLFxuICAgICAgICAgICAgdGFnczogY29uZmlnLnRhZ3MsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEF6dXJlIEtleSBWYXVsdCBmb3Igc2VjcmV0cyBtYW5hZ2VtZW50XG4gICAgICAgIGNvbnN0IGtleVZhdWx0ID0gbmV3IEtleVZhdWx0KHRoaXMsIFwia2V5dmF1bHRcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1rdi0ke2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICBsb2NhdGlvbjogcmcubG9jYXRpb24sXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIHRlbmFudElkOiBhenVyZUNyZWRzLnRlbmFudElkLFxuICAgICAgICAgICAgc2t1TmFtZTogXCJzdGFuZGFyZFwiLFxuICAgICAgICAgICAgZW5hYmxlZEZvckRlcGxveW1lbnQ6IHRydWUsXG4gICAgICAgICAgICBlbmFibGVkRm9yRGlza0VuY3J5cHRpb246IGZhbHNlLFxuICAgICAgICAgICAgZW5hYmxlZEZvclRlbXBsYXRlRGVwbG95bWVudDogdHJ1ZSxcbiAgICAgICAgICAgIGFjY2Vzc1BvbGljeTogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdGVuYW50SWQ6IGF6dXJlQ3JlZHMudGVuYW50SWQsXG4gICAgICAgICAgICAgICAgICAgIG9iamVjdElkOiBjdXJyZW50Q2xpZW50Q29uZmlnLm9iamVjdElkLFxuICAgICAgICAgICAgICAgICAgICBrZXlQZXJtaXNzaW9uczogW1wiR2V0XCIsIFwiTGlzdFwiLCBcIkNyZWF0ZVwiLCBcIkRlbGV0ZVwiLCBcIlVwZGF0ZVwiXSxcbiAgICAgICAgICAgICAgICAgICAgc2VjcmV0UGVybWlzc2lvbnM6IFtcIkdldFwiLCBcIkxpc3RcIiwgXCJTZXRcIiwgXCJEZWxldGVcIl0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU3RvcmUgUG9zdGdyZVNRTCBwYXNzd29yZCBpbiBLZXkgVmF1bHRcbiAgICAgICAgbmV3IEtleVZhdWx0U2VjcmV0KHRoaXMsIFwicGctcGFzc3dvcmQtc2VjcmV0XCIsIHtcbiAgICAgICAgICAgIG5hbWU6IFwicG9zdGdyZXMtcGFzc3dvcmRcIixcbiAgICAgICAgICAgIHZhbHVlOiBwZ1Bhc3N3b3JkLFxuICAgICAgICAgICAga2V5VmF1bHRJZDoga2V5VmF1bHQuaWQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGFjciA9IG5ldyBDb250YWluZXJSZWdpc3RyeSh0aGlzLCBcImFjclwiLCB7XG4gICAgICAgICAgICBuYW1lOiBgcmVjaXBlYm94YWNyJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBsb2NhdGlvbjogcmcubG9jYXRpb24sXG4gICAgICAgICAgICBza3U6IGNvbmZpZy5hY3JTa3UsXG4gICAgICAgICAgICBhZG1pbkVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgc3RvcmFnZUFjY291bnQgPSBuZXcgU3RvcmFnZUFjY291bnQodGhpcywgXCJzdG9yYWdlXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IGByZWNpcGVib3gke2NvbmZpZy5uYW1lfXN0b3JhZ2VgLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBsb2NhdGlvbjogcmcubG9jYXRpb24sXG4gICAgICAgICAgICBhY2NvdW50VGllcjogY29uZmlnLnN0b3JhZ2VBY2NvdW50VGllcixcbiAgICAgICAgICAgIGFjY291bnRSZXBsaWNhdGlvblR5cGU6IGNvbmZpZy5zdG9yYWdlQWNjb3VudFJlcGxpY2F0aW9uLFxuICAgICAgICAgICAgc3RhdGljV2Vic2l0ZToge1xuICAgICAgICAgICAgICAgIGluZGV4RG9jdW1lbnQ6IFwiaW5kZXguaHRtbFwiLFxuICAgICAgICAgICAgICAgIGVycm9yNDA0RG9jdW1lbnQ6IFwiaW5kZXguaHRtbFwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBjZG5Qcm9maWxlID0gbmV3IENkblByb2ZpbGUodGhpcywgXCJjZG5Qcm9maWxlXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IGByZWNpcGVib3gtY2RuLSR7Y29uZmlnLm5hbWV9YCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHJlc291cmNlR3JvdXBOYW1lOiByZy5uYW1lLFxuICAgICAgICAgICAgc2t1OiBjb25maWcuY2RuU2t1LFxuICAgICAgICAgICAgdGFnczogY29uZmlnLnRhZ3MsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNkbkVuZHBvaW50ID0gbmV3IENkbkVuZHBvaW50KHRoaXMsIFwiY2RuRW5kcG9pbnRcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1mcm9udGVuZC0ke2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICBwcm9maWxlTmFtZTogY2RuUHJvZmlsZS5uYW1lLFxuICAgICAgICAgICAgbG9jYXRpb246IHJnLmxvY2F0aW9uLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBvcmlnaW46IFt7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJyZWNpcGVib3gtb3JpZ2luXCIsXG4gICAgICAgICAgICAgICAgaG9zdE5hbWU6IHN0b3JhZ2VBY2NvdW50LnByaW1hcnlXZWJIb3N0LFxuICAgICAgICAgICAgfV0sXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcGdTZXJ2ZXIgPSBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyKHRoaXMsIFwicGdTZXJ2ZXJcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1wZy0ke2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHNrdU5hbWU6IGNvbmZpZy5wZ1NrdU5hbWUsXG4gICAgICAgICAgICBzdG9yYWdlTWI6IGNvbmZpZy5wZ1N0b3JhZ2VNYixcbiAgICAgICAgICAgIHZlcnNpb246IFwiMTVcIixcbiAgICAgICAgICAgIGFkbWluaXN0cmF0b3JMb2dpbjogXCJwZ2FkbWluXCIsXG4gICAgICAgICAgICBhZG1pbmlzdHJhdG9yUGFzc3dvcmQ6IHBnUGFzc3dvcmQsXG4gICAgICAgICAgICB6b25lOiBcIjFcIixcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyRGF0YWJhc2UodGhpcywgXCJwZ0RiXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IFwicmVjaXBlYm94XCIsXG4gICAgICAgICAgICBzZXJ2ZXJJZDogcGdTZXJ2ZXIuaWQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFBvc3RncmVTUUwgRmlyZXdhbGwgUnVsZXMgZm9yIHNlY3VyZSBjbGllbnQgYWNjZXNzXG4gICAgICAgIC8vIEFsbG93IEF6dXJlIFNlcnZpY2VzIHRvIGFjY2VzcyBQb3N0Z3JlU1FMXG4gICAgICAgIG5ldyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJGaXJld2FsbFJ1bGUodGhpcywgXCJwZy1hbGxvdy1henVyZS1zZXJ2aWNlc1wiLCB7XG4gICAgICAgICAgICBuYW1lOiBcIkFsbG93QXp1cmVTZXJ2aWNlc1wiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICAgICAgc3RhcnRJcEFkZHJlc3M6IFwiMC4wLjAuMFwiLFxuICAgICAgICAgICAgZW5kSXBBZGRyZXNzOiBcIjAuMC4wLjBcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWxsb3cgQUtTIHRvIGFjY2VzcyBQb3N0Z3JlU1FMIChvcHRpb25hbDogcmVzdHJpY3QgdG8gc3BlY2lmaWMgSVBzIGlmIGF2YWlsYWJsZSlcbiAgICAgICAgLy8gTm90ZTogSW4gcHJvZHVjdGlvbiwgdXNlIGEgcHJpdmF0ZSBlbmRwb2ludCBpbnN0ZWFkIG9mIGZpcmV3YWxsIHJ1bGVzXG4gICAgICAgIG5ldyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJGaXJld2FsbFJ1bGUodGhpcywgXCJwZy1hbGxvdy1ha3NcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJBbGxvd0FLU1wiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICAgICAgc3RhcnRJcEFkZHJlc3M6IFwiMTAuMC4wLjBcIixcbiAgICAgICAgICAgIGVuZElwQWRkcmVzczogXCIxMC4yNTUuMjU1LjI1NVwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBha3MgPSBuZXcgS3ViZXJuZXRlc0NsdXN0ZXIodGhpcywgXCJha3NcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1ha3MtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgbG9jYXRpb246IHJnLmxvY2F0aW9uLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBkbnNQcmVmaXg6IGByZWNpcGVib3gtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgZGVmYXVsdE5vZGVQb29sOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJkZWZhdWx0XCIsXG4gICAgICAgICAgICAgICAgbm9kZUNvdW50OiBjb25maWcuYWtzTm9kZUNvdW50LFxuICAgICAgICAgICAgICAgIHZtU2l6ZTogY29uZmlnLmFrc1ZtU2l6ZSxcbiAgICAgICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpZGVudGl0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiU3lzdGVtQXNzaWduZWRcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb2xlQmFzZWRBY2Nlc3NDb250cm9sRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgUm9sZUFzc2lnbm1lbnQodGhpcywgXCJhY3JQdWxsXCIsIHtcbiAgICAgICAgICAgIHNjb3BlOiBhY3IuaWQsXG4gICAgICAgICAgICByb2xlRGVmaW5pdGlvbk5hbWU6IFwiQWNyUHVsbFwiLFxuICAgICAgICAgICAgcHJpbmNpcGFsSWQ6IGFrcy5rdWJlbGV0SWRlbnRpdHkub2JqZWN0SWQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEt1YmVybmV0ZXMgcHJvdmlkZXJcbiAgICAgICAgbmV3IEt1YmVybmV0ZXNQcm92aWRlcih0aGlzLCBcIms4c1wiLCB7XG4gICAgICAgICAgICBob3N0OiBha3Mua3ViZUNvbmZpZy5nZXQoMCkuaG9zdCxcbiAgICAgICAgICAgIGNsaWVudENlcnRpZmljYXRlOiBha3Mua3ViZUNvbmZpZy5nZXQoMCkuY2xpZW50Q2VydGlmaWNhdGUsXG4gICAgICAgICAgICBjbGllbnRLZXk6IGFrcy5rdWJlQ29uZmlnLmdldCgwKS5jbGllbnRLZXksXG4gICAgICAgICAgICBjbHVzdGVyQ2FDZXJ0aWZpY2F0ZTogYWtzLmt1YmVDb25maWcuZ2V0KDApLmNsdXN0ZXJDYUNlcnRpZmljYXRlLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBIZWxtIHByb3ZpZGVyXG4gICAgICAgIG5ldyBIZWxtUHJvdmlkZXIodGhpcywgXCJoZWxtXCIsIHtcbiAgICAgICAgICAgIGt1YmVybmV0ZXM6IHtcbiAgICAgICAgICAgICAgICBob3N0OiBha3Mua3ViZUNvbmZpZy5nZXQoMCkuaG9zdCxcbiAgICAgICAgICAgICAgICBjbGllbnRDZXJ0aWZpY2F0ZTogYWtzLmt1YmVDb25maWcuZ2V0KDApLmNsaWVudENlcnRpZmljYXRlLFxuICAgICAgICAgICAgICAgIGNsaWVudEtleTogYWtzLmt1YmVDb25maWcuZ2V0KDApLmNsaWVudEtleSxcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ2FDZXJ0aWZpY2F0ZTogYWtzLmt1YmVDb25maWcuZ2V0KDApLmNsdXN0ZXJDYUNlcnRpZmljYXRlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQXJnb0NEIG5hbWVzcGFjZVxuICAgICAgICBuZXcgTmFtZXNwYWNlKHRoaXMsIFwiYXJnb2NkLW5zXCIsIHtcbiAgICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJhcmdvY2RcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFyZ29DRCBIZWxtIHJlbGVhc2VcbiAgICAgICAgbmV3IFJlbGVhc2UodGhpcywgXCJhcmdvY2RcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJhcmdvY2RcIixcbiAgICAgICAgICAgIHJlcG9zaXRvcnk6IFwiaHR0cHM6Ly9hcmdvcHJvai5naXRodWIuaW8vYXJnby1oZWxtXCIsXG4gICAgICAgICAgICBjaGFydDogXCJhcmdvLWNkXCIsXG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiYXJnb2NkXCIsXG4gICAgICAgICAgICBzZXQ6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IFwic2VydmVyLnNlcnZpY2UudHlwZVwiLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogXCJMb2FkQmFsYW5jZXJcIixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQXJnb0NEIEFwcGxpY2F0aW9uc1xuICAgICAgICBjb25zdCBhcmdvY2RBcHBOYW1lc3BhY2UgPSBuZXcgTmFtZXNwYWNlKHRoaXMsIFwiYXJnb2NkLWFwcHMtbnNcIiwge1xuICAgICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcImFyZ29jZC1hcHBzXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBSZWNpcGVCb3ggQmFja2VuZCBBcHBsaWNhdGlvblxuICAgICAgICBuZXcgTWFuaWZlc3QodGhpcywgXCJyZWNpcGVib3gtYmFja2VuZC1hcHBcIiwge1xuICAgICAgICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgICAgICAgICBhcGlWZXJzaW9uOiBcImFyZ29wcm9qLmlvL3YxYWxwaGExXCIsXG4gICAgICAgICAgICAgICAga2luZDogXCJBcHBsaWNhdGlvblwiLFxuICAgICAgICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IFwicmVjaXBlYm94LWJhY2tlbmRcIixcbiAgICAgICAgICAgICAgICAgICAgbmFtZXNwYWNlOiBcImFyZ29jZFwiLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc3BlYzoge1xuICAgICAgICAgICAgICAgICAgICBwcm9qZWN0OiBcImRlZmF1bHRcIixcbiAgICAgICAgICAgICAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBvVVJMOiByZXBvVXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogXCJrOHNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFJldmlzaW9uOiBcIkhFQURcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlbG06IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZUZpbGVzOiBbXCJ2YWx1ZXMueWFtbFwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXI6IFwiaHR0cHM6Ly9rdWJlcm5ldGVzLmRlZmF1bHQuc3ZjXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lc3BhY2U6IFwiZGVmYXVsdFwiLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzeW5jUG9saWN5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdXRvbWF0ZWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcnVuZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmSGVhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE91dHB1dHNcbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImVudmlyb25tZW50XCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBjb25maWcubmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkRlcGxveWVkIGVudmlyb25tZW50IG5hbWVcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImFjcl9sb2dpbl9zZXJ2ZXJcIiwge1xuICAgICAgICAgICAgdmFsdWU6IGFjci5sb2dpblNlcnZlcixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkF6dXJlIENvbnRhaW5lciBSZWdpc3RyeSBsb2dpbiBzZXJ2ZXJcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImFjcl9uYW1lXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBhY3IubmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkF6dXJlIENvbnRhaW5lciBSZWdpc3RyeSBuYW1lXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJrdWJlX2NvbmZpZ1wiLCB7XG4gICAgICAgICAgICB2YWx1ZTogYWtzLmt1YmVDb25maWdSYXcsXG4gICAgICAgICAgICBzZW5zaXRpdmU6IHRydWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJLdWJlcm5ldGVzIGNsdXN0ZXIga3ViZWNvbmZpZ1wiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwiY2RuX2VuZHBvaW50XCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBjZG5FbmRwb2ludC5mcWRuLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQ0ROIGVuZHBvaW50IEZRRE4gZm9yIHN0YXRpYyBmcm9udGVuZFwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwic3RvcmFnZV9hY2NvdW50X25hbWVcIiwge1xuICAgICAgICAgICAgdmFsdWU6IHN0b3JhZ2VBY2NvdW50Lm5hbWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJTdG9yYWdlIGFjY291bnQgbmFtZSBmb3IgZnJvbnRlbmQgZGVwbG95bWVudFwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwicG9zdGdyZXNxbF9mcWRuXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBwZ1NlcnZlci5mcWRuLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiUG9zdGdyZVNRTCBzZXJ2ZXIgRlFETlwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwia2V5X3ZhdWx0X2lkXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBrZXlWYXVsdC5pZCxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIktleSBWYXVsdCBJRCBmb3Igc2VjcmV0cyBtYW5hZ2VtZW50XCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJyZXNvdXJjZV9ncm91cF9uYW1lXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiByZy5uYW1lLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQXp1cmUgUmVzb3VyY2UgR3JvdXAgbmFtZVwiLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmNvbnN0IGFwcCA9IG5ldyBBcHAoKTtcbm5ldyBNeVN0YWNrKGFwcCwgXCJyZWNpcGVib3gtaW5mcmFcIik7XG5hcHAuc3ludGgoKTsiXX0=