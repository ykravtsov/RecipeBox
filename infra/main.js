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
new MyStack(app, "recipebox-infra");
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFFakMsNENBQTRDO0FBQzVDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUdoQixpQ0FBNkQ7QUFDN0QsbUVBQXVFO0FBQ3ZFLCtFQUEyRTtBQUMzRSx1RkFBbUY7QUFDbkYsdUZBQW1GO0FBQ25GLHVHQUFrRztBQUNsRyx5SEFBbUg7QUFDbkgsbUlBQTRIO0FBa0I1SCxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7QUFFN0MsTUFBTSxrQkFBa0IsR0FBc0M7SUFDNUQsR0FBRyxFQUFFO1FBQ0gsSUFBSSxFQUFFLEtBQUs7UUFDWCxRQUFRLEVBQUUsV0FBVztRQUNyQixNQUFNLEVBQUUsT0FBTztRQUNmLFlBQVksRUFBRSxDQUFDO1FBQ2YsU0FBUyxFQUFFLGlCQUFpQjtRQUM1QixTQUFTLEVBQUUsaUJBQWlCO1FBQzVCLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLElBQUksRUFBRTtZQUNKLFdBQVcsRUFBRSxLQUFLO1lBQ2xCLFNBQVMsRUFBRSxXQUFXO1lBQ3RCLFVBQVUsRUFBRSxhQUFhO1NBQzFCO0tBQ0Y7SUFDRCxPQUFPLEVBQUU7UUFDUCxJQUFJLEVBQUUsU0FBUztRQUNmLFFBQVEsRUFBRSxXQUFXO1FBQ3JCLE1BQU0sRUFBRSxVQUFVO1FBQ2xCLFlBQVksRUFBRSxDQUFDO1FBQ2YsU0FBUyxFQUFFLGlCQUFpQjtRQUM1QixTQUFTLEVBQUUsb0JBQW9CO1FBQy9CLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLElBQUksRUFBRTtZQUNKLFdBQVcsRUFBRSxTQUFTO1lBQ3RCLFNBQVMsRUFBRSxXQUFXO1lBQ3RCLFVBQVUsRUFBRSxTQUFTO1NBQ3RCO0tBQ0Y7SUFDRCxJQUFJLEVBQUU7UUFDSixJQUFJ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RUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxXQUFHLEVBQUUsQ0FBQztBQUN0QixJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUNwQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSBcImRvdGVudlwiO1xuXG4vLyBMb2FkIGVudmlyb25tZW50IHZhcmlhYmxlcyBmcm9tIC5lbnYgZmlsZVxuZG90ZW52LmNvbmZpZygpO1xuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0IHsgQXBwLCBUZXJyYWZvcm1TdGFjaywgVGVycmFmb3JtT3V0cHV0IH0gZnJvbSBcImNka3RmXCI7XG5pbXBvcnQgeyBBenVyZXJtUHJvdmlkZXIgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3Byb3ZpZGVyXCI7XG5pbXBvcnQgeyBSZXNvdXJjZUdyb3VwIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9yZXNvdXJjZS1ncm91cFwiO1xuaW1wb3J0IHsgQ29udGFpbmVyUmVnaXN0cnkgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL2NvbnRhaW5lci1yZWdpc3RyeVwiO1xuaW1wb3J0IHsgS3ViZXJuZXRlc0NsdXN0ZXIgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL2t1YmVybmV0ZXMtY2x1c3RlclwiO1xuaW1wb3J0IHsgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9wb3N0Z3Jlc3FsLWZsZXhpYmxlLXNlcnZlclwiO1xuaW1wb3J0IHsgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyRGF0YWJhc2UgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3Bvc3RncmVzcWwtZmxleGlibGUtc2VydmVyLWRhdGFiYXNlXCI7XG5pbXBvcnQgeyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJGaXJld2FsbFJ1bGUgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3Bvc3RncmVzcWwtZmxleGlibGUtc2VydmVyLWZpcmV3YWxsLXJ1bGVcIjtcbmltcG9ydCB7IERhdGFBenVyZXJtQ2xpZW50Q29uZmlnIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9kYXRhLWF6dXJlcm0tY2xpZW50LWNvbmZpZ1wiO1xuXG4vKipcbiAqIEVudmlyb25tZW50IENvbmZpZ3VyYXRpb25cbiAqIEFkanVzdCB0aGVzZSB2YWx1ZXMgZm9yIGRpZmZlcmVudCBlbnZpcm9ubWVudHMgKGRldiwgc3RhZ2luZywgcHJvZClcbiAqL1xuaW50ZXJmYWNlIEVudmlyb25tZW50Q29uZmlnIHtcbiAgbmFtZTogc3RyaW5nO1xuICBsb2NhdGlvbjogc3RyaW5nO1xuICBhY3JTa3U6IHN0cmluZztcbiAgYWtzTm9kZUNvdW50OiBudW1iZXI7XG4gIGFrc1ZtU2l6ZTogc3RyaW5nO1xuICBwZ1NrdU5hbWU6IHN0cmluZztcbiAgcGdTdG9yYWdlTWI6IG51bWJlcjtcbiAgdGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbn1cblxuY29uc3QgRU5WID0gcHJvY2Vzcy5lbnYuRU5WSVJPTk1FTlQgfHwgXCJkZXZcIjtcblxuY29uc3QgZW52aXJvbm1lbnRDb25maWdzOiBSZWNvcmQ8c3RyaW5nLCBFbnZpcm9ubWVudENvbmZpZz4gPSB7XG4gIGRldjoge1xuICAgIG5hbWU6IFwiZGV2XCIsXG4gICAgbG9jYXRpb246IFwiV2VzdCBVUyAyXCIsXG4gICAgYWNyU2t1OiBcIkJhc2ljXCIsXG4gICAgYWtzTm9kZUNvdW50OiAxLFxuICAgIGFrc1ZtU2l6ZTogXCJTdGFuZGFyZF9EUzJfdjJcIixcbiAgICBwZ1NrdU5hbWU6IFwiQl9TdGFuZGFyZF9CMW1zXCIsXG4gICAgcGdTdG9yYWdlTWI6IDMyNzY4LFxuICAgIHRhZ3M6IHtcbiAgICAgIEVudmlyb25tZW50OiBcImRldlwiLFxuICAgICAgTWFuYWdlZEJ5OiBcIlRlcnJhZm9ybVwiLFxuICAgICAgQ29zdENlbnRlcjogXCJkZXZlbG9wbWVudFwiLFxuICAgIH0sXG4gIH0sXG4gIHN0YWdpbmc6IHtcbiAgICBuYW1lOiBcInN0YWdpbmdcIixcbiAgICBsb2NhdGlvbjogXCJXZXN0IFVTIDJcIixcbiAgICBhY3JTa3U6IFwiU3RhbmRhcmRcIixcbiAgICBha3NOb2RlQ291bnQ6IDIsXG4gICAgYWtzVm1TaXplOiBcIlN0YW5kYXJkX0RTM192MlwiLFxuICAgIHBnU2t1TmFtZTogXCJHUF9TdGFuZGFyZF9EMnNfdjNcIixcbiAgICBwZ1N0b3JhZ2VNYjogNjU1MzYsXG4gICAgdGFnczoge1xuICAgICAgRW52aXJvbm1lbnQ6IFwic3RhZ2luZ1wiLFxuICAgICAgTWFuYWdlZEJ5OiBcIlRlcnJhZm9ybVwiLFxuICAgICAgQ29zdENlbnRlcjogXCJzdGFnaW5nXCIsXG4gICAgfSxcbiAgfSxcbiAgcHJvZDoge1xuICAgIG5hbWU6IFwicHJvZFwiLFxuICAgIGxvY2F0aW9uOiBcIldlc3QgVVMgMlwiLFxuICAgIGFjclNrdTogXCJQcmVtaXVtXCIsXG4gICAgYWtzTm9kZUNvdW50OiAzLFxuICAgIGFrc1ZtU2l6ZTogXCJTdGFuZGFyZF9EUzNfdjJcIixcbiAgICBwZ1NrdU5hbWU6IFwiR1BfU3RhbmRhcmRfRDRzX3YzXCIsXG4gICAgcGdTdG9yYWdlTWI6IDEzMTA3MixcbiAgICB0YWdzOiB7XG4gICAgICBFbnZpcm9ubWVudDogXCJwcm9kXCIsXG4gICAgICBNYW5hZ2VkQnk6IFwiVGVycmFmb3JtXCIsXG4gICAgICBDb3N0Q2VudGVyOiBcInByb2R1Y3Rpb25cIixcbiAgICB9LFxuICB9LFxufTtcblxuY29uc3QgY29uZmlnID0gZW52aXJvbm1lbnRDb25maWdzW0VOVl0gfHwgZW52aXJvbm1lbnRDb25maWdzLmRldjtcblxuLy8gRm9yY2UgaW5pdGlhbCBidWlsZCB0cmlnZ2VyXG5cbmNsYXNzIE15U3RhY2sgZXh0ZW5kcyBUZXJyYWZvcm1TdGFjayB7XG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIC8vIFJFUVVJUkVEIEdJVEhVQiBTRUNSRVRTIChzZXQgdGhlc2UgYmVmb3JlIGRlcGxveW1lbnQpOlxuICAgICAgICAvLyAtIEFaVVJFX0NSRURFTlRJQUxTOiBKU09OIG9iamVjdCB3aXRoIHN1YnNjcmlwdGlvbklkLCB0ZW5hbnRJZCwgY2xpZW50SWQsIGNsaWVudFNlY3JldFxuICAgICAgICAvLyAtIFBPU1RHUkVTX1BBU1NXT1JEOiBTdHJvbmcgcGFzc3dvcmQgKG1pbiA4IGNoYXJzLCBtdXN0IGluY2x1ZGUgdXBwZXJjYXNlLCBsb3dlcmNhc2UsIG51bWJlciwgc3BlY2lhbCBjaGFyKVxuICAgICAgICAvLyAtIEdJVEhVQl9SRVBPU0lUT1JZX1VSTDogRnVsbCBVUkwgdG8gR2l0SHViIHJlcG9zaXRvcnlcblxuICAgICAgICAvLyBHZXQgY29uZmlndXJhdGlvbiBmcm9tIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgICAgICBjb25zdCByZXBvVXJsID0gcHJvY2Vzcy5lbnYuR0lUSFVCX1JFUE9TSVRPUllfVVJMIHx8IFwiaHR0cHM6Ly9naXRodWIuY29tL3lvdXItb3JnL3JlY2lwZWJveFwiO1xuICAgICAgICBjb25zdCBwZ1Bhc3N3b3JkID0gcHJvY2Vzcy5lbnYuUE9TVEdSRVNfUEFTU1dPUkQ7XG4gICAgICAgIGlmICghcGdQYXNzd29yZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUE9TVEdSRVNfUEFTU1dPUkQgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgcmVxdWlyZWRcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYXp1cmVDcmVkcyA9IEpTT04ucGFyc2UocHJvY2Vzcy5lbnYuQVpVUkVfQ1JFREVOVElBTFMgfHwgJ3tcInN1YnNjcmlwdGlvbklkXCI6XCJcIixcInRlbmFudElkXCI6XCJcIixcImNsaWVudElkXCI6XCJcIixcImNsaWVudFNlY3JldFwiOlwiXCJ9Jyk7XG5cbiAgICAgICAgbmV3IEF6dXJlcm1Qcm92aWRlcih0aGlzLCBcIkF6dXJlUm1cIiwge1xuICAgICAgICAgICAgZmVhdHVyZXM6IFt7fV0sXG4gICAgICAgICAgICBzdWJzY3JpcHRpb25JZDogYXp1cmVDcmVkcy5zdWJzY3JpcHRpb25JZCxcbiAgICAgICAgICAgIHRlbmFudElkOiBhenVyZUNyZWRzLnRlbmFudElkLFxuICAgICAgICAgICAgY2xpZW50SWQ6IGF6dXJlQ3JlZHMuY2xpZW50SWQsXG4gICAgICAgICAgICBjbGllbnRTZWNyZXQ6IGF6dXJlQ3JlZHMuY2xpZW50U2VjcmV0LFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCByZyA9IG5ldyBSZXNvdXJjZUdyb3VwKHRoaXMsIFwicmdcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJnLXJlY2lwZWJveC0ke2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICBsb2NhdGlvbjogY29uZmlnLmxvY2F0aW9uLFxuICAgICAgICAgICAgdGFnczogY29uZmlnLnRhZ3MsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGFjciA9IG5ldyBDb250YWluZXJSZWdpc3RyeSh0aGlzLCBcImFjclwiLCB7XG4gICAgICAgICAgICBuYW1lOiBgcmVjaXBlYm94YWNyJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBsb2NhdGlvbjogcmcubG9jYXRpb24sXG4gICAgICAgICAgICBza3U6IGNvbmZpZy5hY3JTa3UsXG4gICAgICAgICAgICBhZG1pbkVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcGdTZXJ2ZXIgPSBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyKHRoaXMsIFwicGdTZXJ2ZXJcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1wZy0ke2NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHNrdU5hbWU6IGNvbmZpZy5wZ1NrdU5hbWUsXG4gICAgICAgICAgICBzdG9yYWdlTWI6IGNvbmZpZy5wZ1N0b3JhZ2VNYixcbiAgICAgICAgICAgIHZlcnNpb246IFwiMTVcIixcbiAgICAgICAgICAgIGFkbWluaXN0cmF0b3JMb2dpbjogXCJwZ2FkbWluXCIsXG4gICAgICAgICAgICBhZG1pbmlzdHJhdG9yUGFzc3dvcmQ6IHBnUGFzc3dvcmQsXG4gICAgICAgICAgICB6b25lOiBcIjFcIixcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgUG9zdGdyZXNxbEZsZXhpYmxlU2VydmVyRGF0YWJhc2UodGhpcywgXCJwZ0RiXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IFwicmVjaXBlYm94XCIsXG4gICAgICAgICAgICBzZXJ2ZXJJZDogcGdTZXJ2ZXIuaWQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFBvc3RncmVTUUwgRmlyZXdhbGwgUnVsZXMgZm9yIHNlY3VyZSBjbGllbnQgYWNjZXNzXG4gICAgICAgIC8vIEFsbG93IEF6dXJlIFNlcnZpY2VzIHRvIGFjY2VzcyBQb3N0Z3JlU1FMXG4gICAgICAgIG5ldyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJGaXJld2FsbFJ1bGUodGhpcywgXCJwZy1hbGxvdy1henVyZS1zZXJ2aWNlc1wiLCB7XG4gICAgICAgICAgICBuYW1lOiBcIkFsbG93QXp1cmVTZXJ2aWNlc1wiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICAgICAgc3RhcnRJcEFkZHJlc3M6IFwiMC4wLjAuMFwiLFxuICAgICAgICAgICAgZW5kSXBBZGRyZXNzOiBcIjAuMC4wLjBcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWxsb3cgQUtTIHRvIGFjY2VzcyBQb3N0Z3JlU1FMIChvcHRpb25hbDogcmVzdHJpY3QgdG8gc3BlY2lmaWMgSVBzIGlmIGF2YWlsYWJsZSlcbiAgICAgICAgLy8gTm90ZTogSW4gcHJvZHVjdGlvbiwgdXNlIGEgcHJpdmF0ZSBlbmRwb2ludCBpbnN0ZWFkIG9mIGZpcmV3YWxsIHJ1bGVzXG4gICAgICAgIG5ldyBQb3N0Z3Jlc3FsRmxleGlibGVTZXJ2ZXJGaXJld2FsbFJ1bGUodGhpcywgXCJwZy1hbGxvdy1ha3NcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJBbGxvd0FLU1wiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICAgICAgc3RhcnRJcEFkZHJlc3M6IFwiMTAuMC4wLjBcIixcbiAgICAgICAgICAgIGVuZElwQWRkcmVzczogXCIxMC4yNTUuMjU1LjI1NVwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBha3MgPSBuZXcgS3ViZXJuZXRlc0NsdXN0ZXIodGhpcywgXCJha3NcIiwge1xuICAgICAgICAgICAgbmFtZTogYHJlY2lwZWJveC1ha3MtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgbG9jYXRpb246IHJnLmxvY2F0aW9uLFxuICAgICAgICAgICAgcmVzb3VyY2VHcm91cE5hbWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBkbnNQcmVmaXg6IGByZWNpcGVib3gtJHtjb25maWcubmFtZX1gLFxuICAgICAgICAgICAgZGVmYXVsdE5vZGVQb29sOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJkZWZhdWx0XCIsXG4gICAgICAgICAgICAgICAgbm9kZUNvdW50OiBjb25maWcuYWtzTm9kZUNvdW50LFxuICAgICAgICAgICAgICAgIHZtU2l6ZTogY29uZmlnLmFrc1ZtU2l6ZSxcbiAgICAgICAgICAgICAgICB0YWdzOiBjb25maWcudGFncyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpZGVudGl0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiU3lzdGVtQXNzaWduZWRcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb2xlQmFzZWRBY2Nlc3NDb250cm9sRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIHRhZ3M6IGNvbmZpZy50YWdzLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDb25maWd1cmUgQUNSIHB1bGwgcGVybWlzc2lvbnMgaW4gcG9zdC1kZXBsb3ltZW50IChyZXF1aXJlcyBVc2VyIEFjY2VzcyBBZG1pbmlzdHJhdG9yIHJvbGUpXG4gICAgICAgIC8vIFNlZSBkZXBsb3kueW1sIGZvciBrdWJlY3RsIGFwcGx5IG9mIEFyZ29DRCArIGltYWdlIHB1bGwgc2VjcmV0c1xuXG4gICAgICAgIC8vIE5PVEU6IEFyZ29DRCBpcyBkZXBsb3llZCBzZXBhcmF0ZWx5IGFmdGVyIGNsdXN0ZXIgaXMgcmVhZHlcbiAgICAgICAgLy8gU2VlOiBrOHMvYXBwbGljYXRpb24ueWFtbCBmb3IgQXJnb0NEIGNvbmZpZ3VyYXRpb25cbiAgICAgICAgLy8gVXNlOiBrdWJlY3RsIGFwcGx5IC1mIGs4cy9hcHBsaWNhdGlvbi55YW1sIGFmdGVyIGNsdXN0ZXIgY3JlYXRpb25cblxuICAgICAgICAvLyBPdXRwdXRzXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJlbnZpcm9ubWVudFwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogY29uZmlnLm5hbWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJEZXBsb3llZCBlbnZpcm9ubWVudCBuYW1lXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJhY3JfbG9naW5fc2VydmVyXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBhY3IubG9naW5TZXJ2ZXIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJBenVyZSBDb250YWluZXIgUmVnaXN0cnkgbG9naW4gc2VydmVyXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBUZXJyYWZvcm1PdXRwdXQodGhpcywgXCJhY3JfbmFtZVwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogYWNyLm5hbWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJBenVyZSBDb250YWluZXIgUmVnaXN0cnkgbmFtZVwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwiYWtzX25hbWVcIiwge1xuICAgICAgICAgICAgdmFsdWU6IGFrcy5uYW1lLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQXp1cmUgS3ViZXJuZXRlcyBTZXJ2aWNlIGNsdXN0ZXIgbmFtZVwiLFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgVGVycmFmb3JtT3V0cHV0KHRoaXMsIFwia3ViZV9jb25maWdcIiwge1xuICAgICAgICAgICAgdmFsdWU6IGFrcy5rdWJlQ29uZmlnUmF3LFxuICAgICAgICAgICAgc2Vuc2l0aXZlOiB0cnVlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiS3ViZXJuZXRlcyBjbHVzdGVyIGt1YmVjb25maWdcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcInBvc3RncmVzcWxfZnFkblwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogcGdTZXJ2ZXIuZnFkbixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIlBvc3RncmVTUUwgc2VydmVyIEZRRE5cIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcInJlc291cmNlX2dyb3VwX25hbWVcIiwge1xuICAgICAgICAgICAgdmFsdWU6IHJnLm5hbWUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJBenVyZSBSZXNvdXJjZSBHcm91cCBuYW1lXCIsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuY29uc3QgYXBwID0gbmV3IEFwcCgpO1xubmV3IE15U3RhY2soYXBwLCBcInJlY2lwZWJveC1pbmZyYVwiKTtcbmFwcC5zeW50aCgpOyJdfQ==