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
        });
        // NOTE: ArgoCD is deployed separately after cluster is ready
        // See: k8s/application.yaml for ArgoCD configuration
        // Use: kubectl apply -f k8s/application.yaml after cluster creation
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsNENBQTRDO0FBQzVDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUdoQixpQ0FBNkQ7QUFDN0QsbUVBQXVFO0FBQ3ZFLCtFQUEyRTtBQUMzRSx1RkFBbUY7QUFDbkYsdUZBQW1GO0FBQ25GLGlGQUE2RTtBQUM3RSx1R0FBa0c7QUFDbEcseUhBQW1IO0FBQ25ILG1JQUE0SDtBQUM1SCxpRkFBNkU7QUFDN0UseUVBQXFFO0FBQ3JFLDJFQUF1RTtBQUN2RSxxRUFBaUU7QUFDakUsbUZBQThFO0FBQzlFLHVHQUFpRztBQW9CakcsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDO0FBRTdDLE1BQU0sa0JBQWtCLEdBQXNDO0lBQzVELEdBQUcsRUFBRTtRQUNILElBQUksRUFBRSxLQUFLO1FBQ1gsUUFBUSxFQUFFLFdBQVc7UUFDckIsTUFBTSxFQUFFLE9BQU87UUFDZixZQUFZLEVBQUUsQ0FBQztRQUNmLFNBQVMsRUFBRSxpQkFBaUI7UUFDNUIsU0FBUyxFQUFFLGlCQUFpQjtRQUM1QixXQUFXLEVBQUUsS0FBSztRQUNsQixrQkFBa0IsRUFBRSxVQUFVO1FBQzlCLHlCQUF5QixFQUFFLEtBQUs7UUFDaEMsTUFBTSxFQUFFLG9CQUFvQjtRQUM1QixJQUFJLEVBQUU7WUFDSixXQUFXLEVBQUUsS0FBSztZQUNsQixTQUFTLEVBQUUsV0FBVztZQUN0QixVQUFVLEVBQUUsYUFBYTtTQUMxQjtLQUNGO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLFNBQVM7UUFDZixRQUFRLEVBQUUsV0FBVztRQUNyQixNQUFNLEVBQUUsVUFBVTtRQUNsQixZQUFZLEVBQUUsQ0FBQztRQUNmLFNBQVMsRUFBRSxpQkFB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QUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxJQUFJO1lBQ3ZCLFdBQVcsRUFBRSx1Q0FBdUM7U0FDdkQsQ0FBQyxDQUFDO1FBRUgsSUFBSSx1QkFBZSxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUM5QyxLQUFLLEVBQUUsY0FBYyxDQUFDLElBQUk7WUFDMUIsV0FBVyxFQUFFLDhDQUE4QztTQUM5RCxDQUFDLENBQUM7UUFFSCxJQUFJLHVCQUFlLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSTtZQUNwQixXQUFXLEVBQUUsd0JBQXdCO1NBQ3hDLENBQUMsQ0FBQztRQUVILElBQUksdUJBQWUsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxRQUFRLENBQUMsRUFBRTtZQUNsQixXQUFXLEVBQUUscUNBQXFDO1NBQ3JELENBQUMsQ0FBQztRQUVILElBQUksdUJBQWUsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDN0MsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJO1lBQ2QsV0FBVyxFQUFFLDJCQUEyQjtTQUMzQyxDQUFDLENBQUM7SUFDUCxDQUFDO0NBQ0o7QUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLFdBQUcsRUFBRSxDQUFDO0FBQ3RCLElBQUksT0FBTyxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0FBQ3BDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGRvdGVudiBmcm9tIFwiZG90ZW52XCI7XG5cbi8vIExvYWQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZyb20gLmVudiBmaWxlXG5kb3RlbnYuY29uZmlnKCk7XG5cbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgeyBBcHAsIFRlcnJhZm9ybVN0YWNrLCBUZXJyYWZvcm1PdXRwdXQgfSBmcm9tIFwiY2RrdGZcIjtcbmltcG9ydCB7IEF6dXJlcm1Qcm92aWRlciB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcHJvdmlkZXJcIjtcbmltcG9ydCB7IFJlc291cmNlR3JvdXAgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3Jlc291cmNlLWdyb3VwXCI7XG5pbXBvcnQgeyBDb250YWluZXJSZWdpc3RyeSB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvY29udGFpbmVyLXJlZ2lzdHJ5XCI7XG5pbXBvcnQgeyBLdWJlcm5ldGVzQ2x1c3RlciB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIva3ViZXJuZXRlcy1jbHVzdGVyXCI7XG5pbXBvcnQgeyBSb2xlQXNzaWdubWVudCB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcm9sZS1hc3NpZ25tZW50XCI7XG5pbXBvcnQgeyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXIgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3Bvc3RncmVzcWwtZmxleGlibGUtc2VydmVyXCI7XG5pbXBvcnQgeyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJEYXRhYmFzZSB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcG9zdGdyZXNxbC1mbGV4aWJsZS1zZXJ2ZXItZGF0YWJhc2VcIjtcbmltcG9ydCB7IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlckZpcmV3YWxsUnVsZSB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcG9zdGdyZXNxbC1mbGV4aWJsZS1zZXJ2ZXItZmlyZXdhbGwtcnVsZVwiO1xuaW1wb3J0IHsgU3RvcmFnZUFjY291bnQgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3N0b3JhZ2UtYWNjb3VudFwiO1xuaW1wb3J0IHsgQ2RuUHJvZmlsZSB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvY2RuLXByb2ZpbGVcIjtcbmltcG9ydCB7IENkbkVuZHBvaW50IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9jZG4tZW5kcG9pbnRcIjtcbmltcG9ydCB7IEtleVZhdWx0IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9rZXktdmF1bHRcIjtcbmltcG9ydCB7IEtleVZhdWx0U2VjcmV0IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9rZXktdmF1bHQtc2VjcmV0XCI7XG5pbXBvcnQgeyBEYXRhQXp1cmVybUNsaWVudENvbmZpZyB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvZGF0YS1henVyZXJtLWNsaWVudC1jb25maWdcIjtcblxuLyoqXG4gKiBFbnZpcm9ubWVudCBDb25maWd1cmF0aW9uXG4gKiBBZGp1c3QgdGhlc2UgdmFsdWVzIGZvciBkaWZmZXJlbnQgZW52aXJvbm1lbnRzIChkZXYsIHN0YWdpbmcsIHByb2QpXG4gKi9cbmludGVyZmFjZSBFbnZpcm9ubWVudENvbmZpZyB7XG4gIG5hbWU6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgYWNyU2t1OiBzdHJpbmc7XG4gIGFrc05vZGVDb3VudDogbnVtYmVyO1xuICBha3NWbVNpemU6IHN0cmluZztcbiAgcGdTa3VOYW1lOiBzdHJpbmc7XG4gIHBnU3RvcmFnZU1iOiBudW1iZXI7XG4gIHN0b3JhZ2VBY2NvdW50VGllcjogc3RyaW5nO1xuICBzdG9yYWdlQWNjb3VudFJlcGxpY2F0aW9uOiBzdHJpbmc7XG4gIGNkblNrdTogc3RyaW5nO1xuICB0YWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5jb25zdCBFTlYgPSBwcm9jZXNzLmVudi5FTlZJUk9OTUVOVCB8fCBcImRldlwiO1xuXG5jb25zdCBlbnZpcm9ubWVudENvbmZpZ3M6IFJlY29yZDxzdHJpbmcsIEVudmlyb25tZW50Q29uZmlnPiA9IHtcbiAgZGV2OiB7XG4gICAgbmFtZTogXCJkZXZcIixcbiAgICBsb2NhdGlvbjogXCJXZXN0IFVTIDJcIixcbiAgICBhY3JTa3U6IFwiQmFzaWNcIixcbiAgICBha3NOb2RlQ291bnQ6IDEsXG4gICAgYWtzVm1TaXplOiBcIlN0YW5kYXJkX0RTMl92MlwiLFxuICAgIHBnU2t1TmFtZTogXCJCX1N0YW5kYXJkX0IxbXNcIixcbiAgICBwZ1N0b3JhZ2VNYjogMzI3NjgsXG4gICAgc3RvcmFnZUFjY291bnRUaWVyOiBcIlN0YW5kYXJkXCIsXG4gICAgc3RvcmFnZUFjY291bnRSZXBsaWNhdGlvbjogXCJMUlNcIixcbiAgICBjZG5Ta3U6IFwiU3RhbmRhcmRfTWljcm9zb2Z0XCIsXG4gICAgdGFnczoge1xuICAgICAgRW52aXJvbm1lbnQ6IFwiZGV2XCIsXG4gICAgICBNYW5hZ2VkQnk6IFwiVGVycmFmb3JtXCIsXG4gICAgICBDb3N0Q2VudGVyOiBcImRldmVsb3BtZW50XCIsXG4gICAgfSxcbiAgfSxcbiAgc3RhZ2luZzoge1xuICAgIG5hbWU6IFwic3RhZ2luZ1wiLFxuICAgIGxvY2F0aW9uOiBcIldlc3QgVVMgMlwiLFxuICAgIGFjclNrdTogXCJTdGFuZGFyZFwiLFxuICAgIGFrc05vZGVDb3VudDogMixcbiAgICBha3NWbVNpemU6IFwiU3RhbmRhcmRfRFMzX3YyXCIsXG4gICAgcGdTa3VOYW1lOiBcIkdQX1N0YW5kYXJkX0Qyc192M1wiLFxuICAgIHBnU3RvcmFnZU1iOiA2NTUzNixcbiAgICBzdG9yYWdlQWNjb3VudFRpZXI6IFwiU3RhbmRhcmRcIixcbiAgICBzdG9yYWdlQWNjb3VudFJlcGxpY2F0aW9uOiBcIkdSU1wiLFxuICAgIGNkblNrdTogXCJTdGFuZGFyZF9NaWNyb3NvZnRcIixcbiAgICB0YWdzOiB7XG4gICAgICBFbnZpcm9ubWVudDogXCJzdGFnaW5nXCIsXG4gICAgICBNYW5hZ2VkQnk6IFwiVGVycmFmb3JtXCIsXG4gICAgICBDb3N0Q2VudGVyOiBcInN0YWdpbmdcIixcbiAgICB9LFxuICB9LFxuICBwcm9kOiB7XG4gICAgbmFtZTogXCJwcm9kXCIsXG4gICAgbG9jYXRpb246IFwiV2VzdCBVUyAyXCIsXG4gICAgYWNyU2t1OiBcIlByZW1pdW1cIixcbiAgICBha3NOb2RlQ291bnQ6IDMsXG4gICAgYWtzVm1TaXplOiBcIlN0YW5kYXJkX0RTM192MlwiLFxuICAgIHBnU2t1TmFtZTogXCJHUF9TdGFuZGFyZF9ENHNfdjNcIixcbiAgICBwZ1N0b3JhZ2VNYjogMTMxMDcyLFxuICAgIHN0b3JhZ2VBY2NvdW50VGllcjogXCJQcmVtaXVtXCIsXG4gICAgc3RvcmFnZUFjY291bnRSZXBsaWNhdGlvbjogXCJHUlNcIixcbiAgICBjZG5Ta3U6IFwiUHJlbWl1bV9NaWNyb3NvZnRcIixcbiAgICB0YWdzOiB7XG4gICAgICBFbnZpcm9ubWVudDogXCJwcm9kXCIsXG4gICAgICBNYW5hZ2VkQnk6IFwiVGVycmFmb3JtXCIsXG4gICAgICBDb3N0Q2VudGVyOiBcInByb2R1Y3Rpb25cIixcbiAgICB9LFxuICB9LFxufTtcblxuY29uc3QgY29uZmlnID0gZW52aXJvbm1lbnRDb25maWdzW0VOVl0gfHwgZW52aXJvbm1lbnRDb25maWdzLmRldjtcblxuLy8gRm9yY2UgaW5pdGlhbCBidWlsZCB0cmlnZ2VyXG5cbmNsYXNzIE15U3RhY2sgZXh0ZW5kcyBUZXJyYWZvcm1TdGFjayB7XG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIC8vIFJFUVVJUkVEIEdJVEhVQiBTRUNSRVRTIChzZXQgdGhlc2UgYmVmb3JlIGRlcGxveW1lbnQpOlxuICAgICAgICAvLyAtIEFaVVJFX0NSRURFTlRJQUxTOiBKU09OIG9iamVjdCB3aXRoIHN1YnNjcmlwdGlvbklkLCB0ZW5hbnRJZCwgY2xpZW50SWQsIGNsaWVudFNlY3JldFxuICAgICAgICAvLyAtIFBPU1RHUkVTX1BBU1NXT1JEOiBTdHJvbmcgcGFzc3dvcmQgKG1pbiA4IGNoYXJzLCBtdXN0IGluY2x1ZGUgdXBwZXJjYXNlLCBsb3dlcmNhc2UsIG51bWJlciwgc3BlY2lhbCBjaGFyKVxuICAgICAgICAvLyAtIEdJVEhVQl9SRVBPU0lUT1JZX1VSTDogRnVsbCBVUkwgdG8gR2l0SHViIHJlcG9zaXRvcnlcblxuICAgICAgICAvLyBHZXQgY29uZmlndXJhdGlvbiBmcm9tIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgICAgICBjb25zdCByZXBvVXJsID0gcHJvY2Vzcy5lbnYuR0lUSFVCX1JFUE9TSVRPUllfVVJMIHx8IFwiaHR0cHM6Ly9naXRodWIuY29tL3lvdXItb3JnL3JlY2lwZWJveFwiO1xuICAgICAgICBjb25zdCBwZ1Bhc3N3b3JkID0gcHJvY2Vzcy5lbnYuUE9TVEdSRVNfUEFTU1dPUkQ7XG4gICAgICAgIGlmICghcGdQYXNzd29yZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUE9TVEdSRVNfUEFTU1dPUkQgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgcmVxdWlyZWRcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYXp1cmVDcmVkcyA9IEpTT04ucGFyc2UocHJvY2Vzcy5lbnYuQVpVUkVfQ1JFREVOVElBTFMgfHwgJ3tcInN1YnNjcmlwdGlvbklkXCI6XCJcIixcInRlbmFudElkXCI6XCJcIixcImNsaWVudElkXCI6XCJcIixcImNsaWVudFNlY3JldFwiOlwiXCJ9Jyk7XG5cbiAgICAgICAgbmV3IEF6dXJlcm1Qcm92aWRlcih0aGlzLCBcIkF6dXJlUm1cIiwge1xuICAgICAgICAgICAgZmVhdHVyZXM6IFt7fV0sXG4gICAgICAgICAgICBzdWJzY3JpcHRpb25JZDogYXp1cmVDcmVkcy5zdWJzY3JpcHRpb25JZCxcbiAgICAgICAgICAgIHRlbmFudElkOiBhenVyZUNyZWRzLnRlbmFudElkLFxuICAgICAgICAgICAgY2xpZW50SWQ6IGF6dXJlQ3JlZHMuY2xpZW50SWQsXG4gICAgICAgICAgICBjbGllbnRTZWNyZXQ6IGF6dXJlQ3JlZHMuY2xpZW50U2VjcmV0LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBHZXQgY3VycmVudCBBenVyZSBjbGllbnQgY29uZmlndXJhdGlvbiBmb3IgS2V5IFZhdWx0IGFjY2VzcyBwb2xpY2llc1xuICAgICAgICBjb25zdCBjdXJyZW50Q2xpZW50Q29uZmlnID0gbmV3IERhdGFBenVyZXJtQ2xpZW50Q29uZmlnKHRoaXMsIFwiY3VycmVudC1jb25maWdcIiwge30pO1xuXG4gICAgICAgIGNvbnN0IHJnID0gbmV3IFJlc291cmNlR3JvdXAodGhpcywgXCJyZ1wiLCB7XG4gICAgICAgICAgICBuYW1lOiBgcmctcmVjaXBlYm94LSR7Y29uZmlnLm5hbWV9YCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiBjb25maWcubG9jYXRpb24sXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQXp1cmUgS2V5IFZhdWx0IGZvciBzZWNyZXRzIG1hbmFnZW1lbnRcbiAgICAgICAgY29uc3Qga2V5VmF1bHQgPSBuZXcgS2V5VmF1bHQodGhpcywgXCJrZXl2YXVsdFwiLCB7XG4gICAgICAgICAgICBuYW1lOiBgcmVjaXBlYm94LWt2LSR7Y29uZmlnLm5hbWV9YCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHJlc291cmNlR3JvdXBOYW1lOiByZy5uYW1lLFxuICAgICAgICAgICAgdGVuYW50SWQ6IGF6dXJlQ3JlZHMudGVuYW50SWQsXG4gICAgICAgICAgICBza3VOYW1lOiBcInN0YW5kYXJkXCIsXG4gICAgICAgICAgICBlbmFibGVkRm9yRGVwbG95bWVudDogdHJ1ZSxcbiAgICAgICAgICAgIGVuYWJsZWRGb3JEaXNrRW5jcnlwdGlvbjogZmFsc2UsXG4gICAgICAgICAgICBlbmFibGVkRm9yVGVtcGxhdGVEZXBsb3ltZW50OiB0cnVlLFxuICAgICAgICAgICAgYWNjZXNzUG9saWN5OiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0ZW5hbnRJZDogYXp1cmVDcmVkcy50ZW5hbnRJZCxcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0SWQ6IGN1cnJlbnRDbGllbnRDb25maWcub2JqZWN0SWQsXG4gICAgICAgICAgICAgICAgICAgIGtleVBlcm1pc3Npb25zOiBbXCJHZXRcIiwgXCJMaXN0XCIsIFwiQ3JlYXRlXCIsIFwiRGVsZXRlXCIsIFwiVXBkYXRlXCJdLFxuICAgICAgICAgICAgICAgICAgICBzZWNyZXRQZXJtaXNzaW9uczogW1wiR2V0XCIsIFwiTGlzdFwiLCBcIlNldFwiLCBcIkRlbGV0ZVwiXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTdG9yZSBQb3N0Z3JlU1FMIHBhc3N3b3JkIGluIEtleSBWYXVsdFxuICAgICAgICBuZXcgS2V5VmF1bHRTZWNyZXQodGhpcywgXCJwZy1wYXNzd29yZC1zZWNyZXRcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJwb3N0Z3Jlcy1wYXNzd29yZFwiLFxuICAgICAgICAgICAgdmFsdWU6IHBnUGFzc3dvcmQsXG4gICAgICAgICAgICBrZXlWYXVsdElkOiBrZXlWYXVsdC5pZCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgYWNyID0gbmV3IENvbnRhaW5lclJlZ2lzdHJ5KHRoaXMsIFwiYWNyXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IGByZWNpcGVib3hhY3Ike2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHNrdTogY29uZmlnLmFjclNrdSxcbiAgICAgICAgICAgIGFkbWluRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBzdG9yYWdlQWNjb3VudCA9IG5ldyBTdG9yYWdlQWNjb3VudCh0aGlzLCBcInN0b3JhZ2VcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveCR7Y29uZmlnLm5hbWV9c3RvcmFnZWAsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIGFjY291bnRUaWVyOiBjb25maWcuc3RvcmFnZUFjY291bnRUaWVyLFxuICAgICAgICAgICAgYWNjb3VudFJlcGxpY2F0aW9uVHlwZTogY29uZmlnLnN0b3JhZ2VBY2NvdW50UmVwbGljYXRpb24sXG4gICAgICAgICAgICBzdGF0aWNXZWJzaXRlOiB7XG4gICAgICAgICAgICAgICAgaW5kZXhEb2N1bWVudDogXCJpbmRleC5odG1sXCIsXG4gICAgICAgICAgICAgICAgZXJyb3I0MDREb2N1bWVudDogXCJpbmRleC5odG1sXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGFnczogY29uZmlnLnRhZ3MsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNkblByb2ZpbGUgPSBuZXcgQ2RuUHJvZmlsZSh0aGlzLCBcImNkblByb2ZpbGVcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1jZG4tJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgbG9jYXRpb246IFwiR2xvYmFsXCIsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIHNrdTogY29uZmlnLmNkblNrdSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBjZG5FbmRwb2ludCA9IG5ldyBDZG5FbmRwb2ludCh0aGlzLCBcImNkbkVuZHBvaW50XCIsIHtcbiAgICAgICAgICAgIG5hbWU6IGByZWNpcGVib3gtZnJvbnRlbmQtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgcHJvZmlsZU5hbWU6IGNkblByb2ZpbGUubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiBcIkdsb2JhbFwiLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBvcmlnaW46IFt7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJyZWNpcGVib3gtb3JpZ2luXCIsXG4gICAgICAgICAgICAgICAgaG9zdE5hbWU6IHN0b3JhZ2VBY2NvdW50LnByaW1hcnlXZWJIb3N0LFxuICAgICAgICAgICAgfV0sXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcGdTZXJ2ZXIgPSBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyKHRoaXMsIFwicGdTZXJ2ZXJcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1wZy0ke2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHNrdU5hbWU6IGNvbmZpZy5wZ1NrdU5hbWUsXG4gICAgICAgICAgICBzdG9yYWdlTWI6IGNvbmZpZy5wZ1N0b3JhZ2VNYixcbiAgICAgICAgICAgIHZlcnNpb246IFwiMTVcIixcbiAgICAgICAgICAgIGFkbWluaXN0cmF0b3JMb2dpbjogXCJwZ2FkbWluXCIsXG4gICAgICAgICAgICBhZG1pbmlzdHJhdG9yUGFzc3dvcmQ6IHBnUGFzc3dvcmQsXG4gICAgICAgICAgICB6b25lOiBcIjFcIixcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyRGF0YWJhc2UodGhpcywgXCJwZ0RiXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IFwicmVjaXBlYm94XCIsXG4gICAgICAgICAgICBzZXJ2ZXJJZDogcGdTZXJ2ZXIuaWQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFBvc3RncmVTUUwgRmlyZXdhbGwgUnVsZXMgZm9yIHNlY3VyZSBjbGllbnQgYWNjZXNzXG4gICAgICAgIC8vIEFsbG93IEF6dXJlIFNlcnZpY2VzIHRvIGFjY2VzcyBQb3N0Z3JlU1FMXG4gICAgICAgIG5ldyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJGaXJld2FsbFJ1bGUodGhpcywgXCJwZy1hbGxvdy1henVyZS1zZXJ2aWNlc1wiLCB7XG4gICAgICAgICAgICBuYW1lOiBcIkFsbG93QXp1cmVTZXJ2aWNlc1wiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICAgICAgc3RhcnRJcEFkZHJlc3M6IFwiMC4wLjAuMFwiLFxuICAgICAgICAgICAgZW5kSXBBZGRyZXNzOiBcIjAuMC4wLjBcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWxsb3cgQUtTIHRvIGFjY2VzcyBQb3N0Z3JlU1FMIChvcHRpb25hbDogcmVzdHJpY3QgdG8gc3BlY2lmaWMgSVBzIGlmIGF2YWlsYWJsZSlcbiAgICAgICAgLy8gTm90ZTogSW4gcHJvZHVjdGlvbiwgdXNlIGEgcHJpdmF0ZSBlbmRwb2ludCBpbnN0ZWFkIG9mIGZpcmV3YWxsIHJ1bGVzXG4gICAgICAgIG5ldyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJGaXJld2FsbFJ1bGUodGhpcywgXCJwZy1hbGxvdy1ha3NcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJBbGxvd0FLU1wiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICAgICAgc3RhcnRJcEFkZHJlc3M6IFwiMTAuMC4wLjBcIixcbiAgICAgICAgICAgIGVuZElwQWRkcmVzczogXCIxMC4yNTUuMjU1LjI1NVwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBha3MgPSBuZXcgS3ViZXJuZXRlc0NsdXN0ZXIodGhpcywgXCJha3NcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1ha3MtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgbG9jYXRpb246IHJnLmxvY2F0aW9uLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBkbnNQcmVmaXg6IGByZWNpcGVib3gtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgZGVmYXVsdE5vZGVQb29sOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJkZWZhdWx0XCIsXG4gICAgICAgICAgICAgICAgbm9kZUNvdW50OiBjb25maWcuYWtzTm9kZUNvdW50LFxuICAgICAgICAgICAgICAgIHZtU2l6ZTogY29uZmlnLmFrc1ZtU2l6ZSxcbiAgICAgICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpZGVudGl0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiU3lzdGVtQXNzaWduZWRcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb2xlQmFzZWRBY2Nlc3NDb250cm9sRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgUm9sZUFzc2lnbm1lbnQodGhpcywgXCJhY3JQdWxsXCIsIHtcbiAgICAgICAgICAgIHNjb3BlOiBhY3IuaWQsXG4gICAgICAgICAgICByb2xlRGVmaW5pdGlvbk5hbWU6IFwiQWNyUHVsbFwiLFxuICAgICAgICAgICAgcHJpbmNpcGFsSWQ6IGFrcy5rdWJlbGV0SWRlbnRpdHkub2JqZWN0SWQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE5PVEU6IEFyZ29DRCBpcyBkZXBsb3llZCBzZXBhcmF0ZWx5IGFmdGVyIGNsdXN0ZXIgaXMgcmVhZHlcbiAgICAgICAgLy8gU2VlOiBrOHMvYXBwbGljYXRpb24ueWFtbCBmb3IgQXJnb0NEIGNvbmZpZ3VyYXRpb25cbiAgICAgICAgLy8gVXNlOiBrdWJlY3RsIGFwcGx5IC1mIGs4cy9hcHBsaWNhdGlvbi55YW1sIGFmdGVyIGNsdXN0ZXIgY3JlYXRpb25cblxuICAgICAgICAvLyBPdXRwdXRzXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJlbnZpcm9ubWVudFwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogY29uZmlnLm5hbWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJEZXBsb3llZCBlbnZpcm9ubWVudCBuYW1lXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJhY3JfbG9naW5fc2VydmVyXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBhY3IubG9naW5TZXJ2ZXIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJBenVyZSBDb250YWluZXIgUmVnaXN0cnkgbG9naW4gc2VydmVyXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJhY3JfbmFtZVwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogYWNyLm5hbWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJBenVyZSBDb250YWluZXIgUmVnaXN0cnkgbmFtZVwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwia3ViZV9jb25maWdcIiwge1xuICAgICAgICAgICAgdmFsdWU6IGFrcy5rdWJlQ29uZmlnUmF3LFxuICAgICAgICAgICAgc2Vuc2l0aXZlOiB0cnVlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiS3ViZXJuZXRlcyBjbHVzdGVyIGt1YmVjb25maWdcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImNkbl9lbmRwb2ludFwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogY2RuRW5kcG9pbnQuZnFkbixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkNETiBlbmRwb2ludCBGUUROIGZvciBzdGF0aWMgZnJvbnRlbmRcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcInN0b3JhZ2VfYWNjb3VudF9uYW1lXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBzdG9yYWdlQWNjb3VudC5uYW1lLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiU3RvcmFnZSBhY2NvdW50IG5hbWUgZm9yIGZyb250ZW5kIGRlcGxveW1lbnRcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcInBvc3RncmVzcWxfZnFkblwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogcGdTZXJ2ZXIuZnFkbixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIlBvc3RncmVTUUwgc2VydmVyIEZRRE5cIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImtleV92YXVsdF9pZFwiLCB7XG4gICAgICAgICAgICB2YWx1ZToga2V5VmF1bHQuaWQsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJLZXkgVmF1bHQgSUQgZm9yIHNlY3JldHMgbWFuYWdlbWVudFwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwicmVzb3VyY2VfZ3JvdXBfbmFtZVwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogcmcubmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkF6dXJlIFJlc291cmNlIEdyb3VwIG5hbWVcIixcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5jb25zdCBhcHAgPSBuZXcgQXBwKCk7XG5uZXcgTXlTdGFjayhhcHAsIFwicmVjaXBlYm94LWluZnJhXCIpO1xuYXBwLnN5bnRoKCk7Il19