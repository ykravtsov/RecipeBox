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
const postgresql_flexible_server_1 = require("@cdktf/provider-azurerm/lib/postgresql-flexible-server");
const postgresql_flexible_server_database_1 = require("@cdktf/provider-azurerm/lib/postgresql-flexible-server-database");
const postgresql_flexible_server_firewall_rule_1 = require("@cdktf/provider-azurerm/lib/postgresql-flexible-server-firewall-rule");
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
        const rg = new resource_group_1.ResourceGroup(this, "rg", {
            name: `rg-recipebox-${config.name}`,
            location: config.location,
            tags: config.tags,
        });
        const acr = new container_registry_1.ContainerRegistry(this, "acr", {
            name: `recipeboxacr${config.name}`,
            resourceGroupName: rg.name,
            location: rg.location,
            sku: config.acrSku,
            adminEnabled: true,
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
        // Configure ACR pull permissions in post-deployment (requires User Access Administrator role)
        // See deploy.yml for kubectl apply of ArgoCD + image pull secrets
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
        new cdktf_1.TerraformOutput(this, "aks_name", {
            value: aks.name,
            description: "Azure Kubernetes Service cluster name",
        });
        new cdktf_1.TerraformOutput(this, "kube_config", {
            value: aks.kubeConfigRaw,
            sensitive: true,
            description: "Kubernetes cluster kubeconfig",
        });
        new cdktf_1.TerraformOutput(this, "postgresql_fqdn", {
            value: pgServer.fqdn,
            description: "PostgreSQL server FQDN",
        });
        new cdktf_1.TerraformOutput(this, "resource_group_name", {
            value: rg.name,
            description: "Azure Resource Group name",
        });
    }
}
const app = new cdktf_1.App();
const stack = new MyStack(app, "recipebox-infra");
new cdktf_1.AzurermBackend(stack, {
    resourceGroupName: "rg-recipebox-dev",
    storageAccountName: "recipeboxtfstate",
    containerName: "tfstate",
    key: "recipebox-infra.tfstate",
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsNENBQTRDO0FBQzVDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUdoQixpQ0FBNkU7QUFDN0UsbUVBQXVFO0FBQ3ZFLCtFQUEyRTtBQUMzRSx1RkFBbUY7QUFDbkYsdUZBQW1GO0FBQ25GLHVHQUFrRztBQUNsRyx5SEFBbUg7QUFDbkgsbUlBQTRIO0FBa0I1SCxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7QUFFN0MsTUFBTSxrQkFBa0IsR0FBc0M7SUFDNUQsR0FBRyxFQUFFO1FBQ0gsSUFBSSxFQUFFLEtBQUs7UUFDWCxRQUFRLEVBQUUsV0FBVztRQUNyQixNQUFNLEVBQUUsT0FBTztRQUNmLFlBQVksRUFBRSxDQUFDO1FBQ2YsU0FBUyxFQUFFLGlCQUFpQjtRQUM1QixTQUFTLEVBQUUsaUJBQWlCO1FBQzVCLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLElBQUksRUFBRTtZQUNKLFdBQVcsRUFBRSxLQUFLO1lBQ2xCLFNBQVMsRUFBRSxXQUFXO1lBQ3RCLFVBQVUsRUFBRSxhQUFhO1NBQzFCO0tBQ0Y7SUFDRCxPQUFPLEVBQUU7UUFDUCxJQUFJLEVBQUUsU0FBUztRQUNmLFFBQVEsRUFBRSxXQUFXO1FBQ3JCLE1BQU0sRUFBRSxVQUFVO1FBQ2xCLFlBQVksRUFBRSxDQUFDO1FBQ2YsU0FBUyxFQUFFLGlCQUFpQjtRQUM1QixTQUFTLEVBQUUsb0JBQW9CO1FBQy9CLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLElBQUksRUFBRTtZQUNKLFdBQVcsRUFBRSxTQUFTO1lBQ3RCLFNBQVMsRUFBRSxXQUFXO1lBQ3RCLFVBQVUsRUFBRSxTQUFTO1NBQ3RCO0tBQ0Y7SUFDRCxJQUFJLEVBQUU7UUFDSixJQUFJ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RUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxXQUFHLEVBQUUsQ0FBQztBQUN0QixNQUFNLEtBQUssR0FBRyxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUNsRCxJQUFJLHNCQUFjLENBQUMsS0FBSyxFQUFFO0lBQ3RCLGlCQUFpQixFQUFFLGtCQUFrQjtJQUNyQyxrQkFBa0IsRUFBRSxrQkFBa0I7SUFDdEMsYUFBYSxFQUFFLFNBQVM7SUFDeEIsR0FBRyxFQUFFLHlCQUF5QjtDQUNqQyxDQUFDLENBQUM7QUFDSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuXG4vLyBMb2FkIGVudmlyb25tZW50IHZhcmlhYmxlcyBmcm9tIC5lbnYgZmlsZVxuZG90ZW52LmNvbmZpZygpO1xuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0IHsgQXBwLCBUZXJyYWZvcm1TdGFjaywgVGVycmFmb3JtT3V0cHV0LCBBenVyZXJtQmFja2VuZCB9IGZyb20gXCJjZGt0ZlwiO1xuaW1wb3J0IHsgQXp1cmVybVByb3ZpZGVyIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9wcm92aWRlclwiO1xuaW1wb3J0IHsgUmVzb3VyY2VHcm91cCB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcmVzb3VyY2UtZ3JvdXBcIjtcbmltcG9ydCB7IENvbnRhaW5lclJlZ2lzdHJ5IH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9jb250YWluZXItcmVnaXN0cnlcIjtcbmltcG9ydCB7IEt1YmVybmV0ZXNDbHVzdGVyIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9rdWJlcm5ldGVzLWNsdXN0ZXJcIjtcbmltcG9ydCB7IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlciB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcG9zdGdyZXNxbC1mbGV4aWJsZS1zZXJ2ZXJcIjtcbmltcG9ydCB7IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlckRhdGFiYXNlIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9wb3N0Z3Jlc3FsLWZsZXhpYmxlLXNlcnZlci1kYXRhYmFzZVwiO1xuaW1wb3J0IHsgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyRmlyZXdhbGxSdWxlIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9wb3N0Z3Jlc3FsLWZsZXhpYmxlLXNlcnZlci1maXJld2FsbC1ydWxlXCI7XG5pbXBvcnQgeyBEYXRhQXp1cmVybUNsaWVudENvbmZpZyB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvZGF0YS1henVyZXJtLWNsaWVudC1jb25maWdcIjtcblxuLyoqXG4gKiBFbnZpcm9ubWVudCBDb25maWd1cmF0aW9uXG4gKiBBZGp1c3QgdGhlc2UgdmFsdWVzIGZvciBkaWZmZXJlbnQgZW52aXJvbm1lbnRzIChkZXYsIHN0YWdpbmcsIHByb2QpXG4gKi9cbmludGVyZmFjZSBFbnZpcm9ubWVudENvbmZpZyB7XG4gIG5hbWU6IHN0cmluZztcbiAgbG9jYXRpb246IHN0cmluZztcbiAgYWNyU2t1OiBzdHJpbmc7XG4gIGFrc05vZGVDb3VudDogbnVtYmVyO1xuICBha3NWbVNpemU6IHN0cmluZztcbiAgcGdTa3VOYW1lOiBzdHJpbmc7XG4gIHBnU3RvcmFnZU1iOiBudW1iZXI7XG4gIHRhZ3M6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmNvbnN0IEVOViA9IHByb2Nlc3MuZW52LkVOVklST05NRU5UIHx8IFwiZGV2XCI7XG5cbmNvbnN0IGVudmlyb25tZW50Q29uZmlnczogUmVjb3JkPHN0cmluZywgRW52aXJvbm1lbnRDb25maWc+ID0ge1xuICBkZXY6IHtcbiAgICBuYW1lOiBcImRldlwiLFxuICAgIGxvY2F0aW9uOiBcIldlc3QgVVMgMlwiLFxuICAgIGFjclNrdTogXCJCYXNpY1wiLFxuICAgIGFrc05vZGVDb3VudDogMSxcbiAgICBha3NWbVNpemU6IFwiU3RhbmRhcmRfRFMyX3YyXCIsXG4gICAgcGdTa3VOYW1lOiBcIkJfU3RhbmRhcmRfQjFtc1wiLFxuICAgIHBnU3RvcmFnZU1iOiAzMjc2OCxcbiAgICB0YWdzOiB7XG4gICAgICBFbnZpcm9ubWVudDogXCJkZXZcIixcbiAgICAgIE1hbmFnZWRCeTogXCJUZXJyYWZvcm1cIixcbiAgICAgIENvc3RDZW50ZXI6IFwiZGV2ZWxvcG1lbnRcIixcbiAgICB9LFxuICB9LFxuICBzdGFnaW5nOiB7XG4gICAgbmFtZTogXCJzdGFnaW5nXCIsXG4gICAgbG9jYXRpb246IFwiV2VzdCBVUyAyXCIsXG4gICAgYWNyU2t1OiBcIlN0YW5kYXJkXCIsXG4gICAgYWtzTm9kZUNvdW50OiAyLFxuICAgIGFrc1ZtU2l6ZTogXCJTdGFuZGFyZF9EUzNfdjJcIixcbiAgICBwZ1NrdU5hbWU6IFwiR1BfU3RhbmRhcmRfRDJzX3YzXCIsXG4gICAgcGdTdG9yYWdlTWI6IDY1NTM2LFxuICAgIHRhZ3M6IHtcbiAgICAgIEVudmlyb25tZW50OiBcInN0YWdpbmdcIixcbiAgICAgIE1hbmFnZWRCeTogXCJUZXJyYWZvcm1cIixcbiAgICAgIENvc3RDZW50ZXI6IFwic3RhZ2luZ1wiLFxuICAgIH0sXG4gIH0sXG4gIHByb2Q6IHtcbiAgICBuYW1lOiBcInByb2RcIixcbiAgICBsb2NhdGlvbjogXCJXZXN0IFVTIDJcIixcbiAgICBhY3JTa3U6IFwiUHJlbWl1bVwiLFxuICAgIGFrc05vZGVDb3VudDogMyxcbiAgICBha3NWbVNpemU6IFwiU3RhbmRhcmRfRFMzX3YyXCIsXG4gICAgcGdTa3VOYW1lOiBcIkdQX1N0YW5kYXJkX0Q0c192M1wiLFxuICAgIHBnU3RvcmFnZU1iOiAxMzEwNzIsXG4gICAgdGFnczoge1xuICAgICAgRW52aXJvbm1lbnQ6IFwicHJvZFwiLFxuICAgICAgTWFuYWdlZEJ5OiBcIlRlcnJhZm9ybVwiLFxuICAgICAgQ29zdENlbnRlcjogXCJwcm9kdWN0aW9uXCIsXG4gICAgfSxcbiAgfSxcbn07XG5cbmNvbnN0IGNvbmZpZyA9IGVudmlyb25tZW50Q29uZmlnc1tFTlZdIHx8IGVudmlyb25tZW50Q29uZmlncy5kZXY7XG5cbi8vIEZvcmNlIGluaXRpYWwgYnVpbGQgdHJpZ2dlclxuXG5jbGFzcyBNeVN0YWNrIGV4dGVuZHMgVGVycmFmb3JtU3RhY2sge1xuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgICAgICAvLyBSRVFVSVJFRCBHSVRIVUIgU0VDUkVUUyAoc2V0IHRoZXNlIGJlZm9yZSBkZXBsb3ltZW50KTpcbiAgICAgICAgLy8gLSBBWlVSRV9DUkVERU5USUFMUzogSlNPTiBvYmplY3Qgd2l0aCBzdWJzY3JpcHRpb25JZCwgdGVuYW50SWQsIGNsaWVudElkLCBjbGllbnRTZWNyZXRcbiAgICAgICAgLy8gLSBQT1NUR1JFU19QQVNTV09SRDogU3Ryb25nIHBhc3N3b3JkIChtaW4gOCBjaGFycywgbXVzdCBpbmNsdWRlIHVwcGVyY2FzZSwgbG93ZXJjYXNlLCBudW1iZXIsIHNwZWNpYWwgY2hhcilcbiAgICAgICAgLy8gLSBHSVRIVUJfUkVQT1NJVE9SWV9VUkw6IEZ1bGwgVVJMIHRvIEdpdEh1YiByZXBvc2l0b3J5XG5cbiAgICAgICAgLy8gR2V0IGNvbmZpZ3VyYXRpb24gZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICAgICAgY29uc3QgcmVwb1VybCA9IHByb2Nlc3MuZW52LkdJVEhVQl9SRVBPU0lUT1JZX1VSTCB8fCBcImh0dHBzOi8vZ2l0aHViLmNvbS95b3VyLW9yZy9yZWNpcGVib3hcIjtcbiAgICAgICAgY29uc3QgcGdQYXNzd29yZCA9IHByb2Nlc3MuZW52LlBPU1RHUkVTX1BBU1NXT1JEO1xuICAgICAgICBpZiAoIXBnUGFzc3dvcmQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlBPU1RHUkVTX1BBU1NXT1JEIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHJlcXVpcmVkXCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGF6dXJlQ3JlZHMgPSBKU09OLnBhcnNlKHByb2Nlc3MuZW52LkFaVVJFX0NSRURFTlRJQUxTIHx8ICd7XCJzdWJzY3JpcHRpb25JZFwiOlwiXCIsXCJ0ZW5hbnRJZFwiOlwiXCIsXCJjbGllbnRJZFwiOlwiXCIsXCJjbGllbnRTZWNyZXRcIjpcIlwifScpO1xuXG4gICAgICAgIG5ldyBBenVyZXJtUHJvdmlkZXIodGhpcywgXCJBenVyZVJtXCIsIHtcbiAgICAgICAgICAgIGZlYXR1cmVzOiBbe31dLFxuICAgICAgICAgICAgc3Vic2NyaXB0aW9uSWQ6IGF6dXJlQ3JlZHMuc3Vic2NyaXB0aW9uSWQsXG4gICAgICAgICAgICB0ZW5hbnRJZDogYXp1cmVDcmVkcy50ZW5hbnRJZCxcbiAgICAgICAgICAgIGNsaWVudElkOiBhenVyZUNyZWRzLmNsaWVudElkLFxuICAgICAgICAgICAgY2xpZW50U2VjcmV0OiBhenVyZUNyZWRzLmNsaWVudFNlY3JldCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcmcgPSBuZXcgUmVzb3VyY2VHcm91cCh0aGlzLCBcInJnXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IGByZy1yZWNpcGVib3gtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgbG9jYXRpb246IGNvbmZpZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBhY3IgPSBuZXcgQ29udGFpbmVyUmVnaXN0cnkodGhpcywgXCJhY3JcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveGFjciR7Y29uZmlnLm5hbWV9YCxcbiAgICAgICAgICAgIHJlc291cmNlR3JvdXBOYW1lOiByZy5uYW1lLFxuICAgICAgICAgICAgbG9jYXRpb246IHJnLmxvY2F0aW9uLFxuICAgICAgICAgICAgc2t1OiBjb25maWcuYWNyU2t1LFxuICAgICAgICAgICAgYWRtaW5FbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgdGFnczogY29uZmlnLnRhZ3MsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHBnU2VydmVyID0gbmV3IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlcih0aGlzLCBcInBnU2VydmVyXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IGByZWNpcGVib3gtcGctJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBsb2NhdGlvbjogcmcubG9jYXRpb24sXG4gICAgICAgICAgICBza3VOYW1lOiBjb25maWcucGdTa3VOYW1lLFxuICAgICAgICAgICAgc3RvcmFnZU1iOiBjb25maWcucGdTdG9yYWdlTWIsXG4gICAgICAgICAgICB2ZXJzaW9uOiBcIjE1XCIsXG4gICAgICAgICAgICBhZG1pbmlzdHJhdG9yTG9naW46IFwicGdhZG1pblwiLFxuICAgICAgICAgICAgYWRtaW5pc3RyYXRvclBhc3N3b3JkOiBwZ1Bhc3N3b3JkLFxuICAgICAgICAgICAgem9uZTogXCIxXCIsXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlckRhdGFiYXNlKHRoaXMsIFwicGdEYlwiLCB7XG4gICAgICAgICAgICBuYW1lOiBcInJlY2lwZWJveFwiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBQb3N0Z3JlU1FMIEZpcmV3YWxsIFJ1bGVzIGZvciBzZWN1cmUgY2xpZW50IGFjY2Vzc1xuICAgICAgICAvLyBBbGxvdyBBenVyZSBTZXJ2aWNlcyB0byBhY2Nlc3MgUG9zdGdyZVNRTFxuICAgICAgICBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyRmlyZXdhbGxSdWxlKHRoaXMsIFwicGctYWxsb3ctYXp1cmUtc2VydmljZXNcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJBbGxvd0F6dXJlU2VydmljZXNcIixcbiAgICAgICAgICAgIHNlcnZlcklkOiBwZ1NlcnZlci5pZCxcbiAgICAgICAgICAgIHN0YXJ0SXBBZGRyZXNzOiBcIjAuMC4wLjBcIixcbiAgICAgICAgICAgIGVuZElwQWRkcmVzczogXCIwLjAuMC4wXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFsbG93IEFLUyB0byBhY2Nlc3MgUG9zdGdyZVNRTCAob3B0aW9uYWw6IHJlc3RyaWN0IHRvIHNwZWNpZmljIElQcyBpZiBhdmFpbGFibGUpXG4gICAgICAgIC8vIE5vdGU6IEluIHByb2R1Y3Rpb24sIHVzZSBhIHByaXZhdGUgZW5kcG9pbnQgaW5zdGVhZCBvZiBmaXJld2FsbCBydWxlc1xuICAgICAgICBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyRmlyZXdhbGxSdWxlKHRoaXMsIFwicGctYWxsb3ctYWtzXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IFwiQWxsb3dBS1NcIixcbiAgICAgICAgICAgIHNlcnZlcklkOiBwZ1NlcnZlci5pZCxcbiAgICAgICAgICAgIHN0YXJ0SXBBZGRyZXNzOiBcIjEwLjAuMC4wXCIsXG4gICAgICAgICAgICBlbmRJcEFkZHJlc3M6IFwiMTAuMjU1LjI1NS4yNTVcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgYWtzID0gbmV3IEt1YmVybmV0ZXNDbHVzdGVyKHRoaXMsIFwiYWtzXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IGByZWNpcGVib3gtYWtzLSR7Y29uZmlnLm5hbWV9YCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHJlc291cmNlR3JvdXBOYW1lOiByZy5uYW1lLFxuICAgICAgICAgICAgZG5zUHJlZml4OiBgcmVjaXBlYm94LSR7Y29uZmlnLm5hbWV9YCxcbiAgICAgICAgICAgIGRlZmF1bHROb2RlUG9vbDoge1xuICAgICAgICAgICAgICAgIG5hbWU6IFwiZGVmYXVsdFwiLFxuICAgICAgICAgICAgICAgIG5vZGVDb3VudDogY29uZmlnLmFrc05vZGVDb3VudCxcbiAgICAgICAgICAgICAgICB2bVNpemU6IGNvbmZpZy5ha3NWbVNpemUsXG4gICAgICAgICAgICAgICAgdGFnczogY29uZmlnLnRhZ3MsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaWRlbnRpdHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIlN5c3RlbUFzc2lnbmVkXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm9sZUJhc2VkQWNjZXNzQ29udHJvbEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQ29uZmlndXJlIEFDUiBwdWxsIHBlcm1pc3Npb25zIGluIHBvc3QtZGVwbG95bWVudCAocmVxdWlyZXMgVXNlciBBY2Nlc3MgQWRtaW5pc3RyYXRvciByb2xlKVxuICAgICAgICAvLyBTZWUgZGVwbG95LnltbCBmb3Iga3ViZWN0bCBhcHBseSBvZiBBcmdvQ0QgKyBpbWFnZSBwdWxsIHNlY3JldHNcblxuICAgICAgICAvLyBOT1RFOiBBcmdvQ0QgaXMgZGVwbG95ZWQgc2VwYXJhdGVseSBhZnRlciBjbHVzdGVyIGlzIHJlYWR5XG4gICAgICAgIC8vIFNlZTogazhzL2FwcGxpY2F0aW9uLnlhbWwgZm9yIEFyZ29DRCBjb25maWd1cmF0aW9uXG4gICAgICAgIC8vIFVzZToga3ViZWN0bCBhcHBseSAtZiBrOHMvYXBwbGljYXRpb24ueWFtbCBhZnRlciBjbHVzdGVyIGNyZWF0aW9uXG5cbiAgICAgICAgLy8gT3V0cHV0c1xuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwiZW52aXJvbm1lbnRcIiwge1xuICAgICAgICAgICAgdmFsdWU6IGNvbmZpZy5uYW1lLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiRGVwbG95ZWQgZW52aXJvbm1lbnQgbmFtZVwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwiYWNyX2xvZ2luX3NlcnZlclwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogYWNyLmxvZ2luU2VydmVyLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQXp1cmUgQ29udGFpbmVyIFJlZ2lzdHJ5IGxvZ2luIHNlcnZlclwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwiYWNyX25hbWVcIiwge1xuICAgICAgICAgICAgdmFsdWU6IGFjci5uYW1lLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQXp1cmUgQ29udGFpbmVyIFJlZ2lzdHJ5IG5hbWVcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImFrc19uYW1lXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBha3MubmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkF6dXJlIEt1YmVybmV0ZXMgU2VydmljZSBjbHVzdGVyIG5hbWVcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImt1YmVfY29uZmlnXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBha3Mua3ViZUNvbmZpZ1JhdyxcbiAgICAgICAgICAgIHNlbnNpdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkt1YmVybmV0ZXMgY2x1c3RlciBrdWJlY29uZmlnXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJwb3N0Z3Jlc3FsX2ZxZG5cIiwge1xuICAgICAgICAgICAgdmFsdWU6IHBnU2VydmVyLmZxZG4sXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJQb3N0Z3JlU1FMIHNlcnZlciBGUUROXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJyZXNvdXJjZV9ncm91cF9uYW1lXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiByZy5uYW1lLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQXp1cmUgUmVzb3VyY2UgR3JvdXAgbmFtZVwiLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmNvbnN0IGFwcCA9IG5ldyBBcHAoKTtcbmNvbnN0IHN0YWNrID0gbmV3IE15U3RhY2soYXBwLCBcInJlY2lwZWJveC1pbmZyYVwiKTtcbm5ldyBBenVyZXJtQmFja2VuZChzdGFjaywge1xuICAgIHJlc291cmNlR3JvdXBOYW1lOiBcInJnLXJlY2lwZWJveC1kZXZcIixcbiAgICBzdG9yYWdlQWNjb3VudE5hbWU6IFwicmVjaXBlYm94dGZzdGF0ZVwiLFxuICAgIGNvbnRhaW5lck5hbWU6IFwidGZzdGF0ZVwiLFxuICAgIGtleTogXCJyZWNpcGVib3gtaW5mcmEudGZzdGF0ZVwiLFxufSk7XG5hcHAuc3ludGgoKTsiXX0=