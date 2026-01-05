"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const manifest_1 = require("@cdktf/provider-kubernetes/lib/manifest");
const storage_account_1 = require("@cdktf/provider-azurerm/lib/storage-account");
const cdn_profile_1 = require("@cdktf/provider-azurerm/lib/cdn-profile");
const cdn_endpoint_1 = require("@cdktf/provider-azurerm/lib/cdn-endpoint");
class MyStack extends cdktf_1.TerraformStack {
    constructor(scope, id) {
        super(scope, id);
        // Get repository URL from environment or use default
        const repoUrl = process.env.GITHUB_REPOSITORY_URL || "https://github.com/your-org/recipebox";
        const pgPassword = process.env.POSTGRES_PASSWORD || "P@ssw0rd123!";
        new provider_1.AzurermProvider(this, "AzureRm", {
            features: [{}],
        });
        const rg = new resource_group_1.ResourceGroup(this, "rg", {
            name: "rg-recipebox",
            location: "East US",
            tags: {
                Environment: "dev",
            },
        });
        const acr = new container_registry_1.ContainerRegistry(this, "acr", {
            name: "recipeboxacr",
            resourceGroupName: rg.name,
            location: rg.location,
            sku: "Basic",
            tags: {
                Environment: "dev",
            },
        });
        const storageAccount = new storage_account_1.StorageAccount(this, "storage", {
            name: "recipeboxstorage",
            resourceGroupName: rg.name,
            location: rg.location,
            accountTier: "Standard",
            accountReplicationType: "LRS",
            staticWebsite: {
                indexDocument: "index.html",
                error404Document: "index.html",
            },
            tags: {
                Environment: "dev",
            },
        });
        const cdnProfile = new cdn_profile_1.CdnProfile(this, "cdnProfile", {
            name: "recipebox-cdn",
            location: rg.location,
            resourceGroupName: rg.name,
            sku: "Standard_Microsoft",
            tags: {
                Environment: "dev",
            },
        });
        const cdnEndpoint = new cdn_endpoint_1.CdnEndpoint(this, "cdnEndpoint", {
            name: "recipebox-frontend",
            profileName: cdnProfile.name,
            location: rg.location,
            resourceGroupName: rg.name,
            origin: [{
                    name: "recipebox-origin",
                    hostName: storageAccount.primaryWebHost,
                }],
            tags: {
                Environment: "dev",
            },
        });
        const pgServer = new postgresql_flexible_server_1.PostgresqlFlexibleServer(this, "pgServer", {
            name: "recipebox-pg",
            resourceGroupName: rg.name,
            location: rg.location,
            skuName: "B_Standard_B1ms",
            storageMb: 32768,
            version: "15",
            administratorLogin: "pgadmin",
            administratorPassword: pgPassword,
            zone: "1",
            tags: {
                Environment: "dev",
            },
        });
        new postgresql_flexible_server_database_1.PostgresqlFlexibleServerDatabase(this, "pgDb", {
            name: "recipebox",
            serverId: pgServer.id,
        });
        const aks = new kubernetes_cluster_1.KubernetesCluster(this, "aks", {
            name: "recipebox-aks",
            location: rg.location,
            resourceGroupName: rg.name,
            dnsPrefix: "recipebox",
            defaultNodePool: {
                name: "default",
                nodeCount: 1,
                vmSize: "Standard_DS2_v2",
            },
            identity: {
                type: "SystemAssigned",
            },
            roleBasedAccessControlEnabled: true,
            tags: {
                Environment: "dev",
            },
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
        // RecipeBox API Application
        new manifest_1.Manifest(this, "recipebox-api-app", {
            manifest: {
                apiVersion: "argoproj.io/v1alpha1",
                kind: "Application",
                metadata: {
                    name: "recipebox-api",
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
        new cdktf_1.TerraformOutput(this, "kube_config", {
            value: aks.kubeConfigRaw,
        });
        new cdktf_1.TerraformOutput(this, "cdn_endpoint", {
            value: cdnEndpoint.fqdn,
        });
    }
}
const app = new cdktf_1.App();
new MyStack(app, "recipebox-infra");
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxpQ0FBNkQ7QUFDN0QsbUVBQXVFO0FBQ3ZFLCtFQUEyRTtBQUMzRSx1RkFBbUY7QUFDbkYsdUZBQW1GO0FBQ25GLGlGQUE2RTtBQUM3RSxzRUFBNkU7QUFDN0UsZ0VBQWlFO0FBQ2pFLHdFQUFxRTtBQUNyRSw4REFBMkQ7QUFDM0QsdUdBQWtHO0FBQ2xHLHlIQUFtSDtBQUNuSCxzRUFBbUU7QUFDbkUsaUZBQTZFO0FBQzdFLHlFQUFxRTtBQUNyRSwyRUFBdUU7QUFFdkUsTUFBTSxPQUFRLFNBQVEsc0JBQWM7SUFDaEMsWUFBWSxLQUFnQixFQUFFLEVBQVU7UUFDcEMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixxREFBcUQ7UUFDckQsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsSUFBSSx1Q0FBdUMsQ0FBQztRQUM3RixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixJQUFJLGNBQWMsQ0FBQztRQUVuRSxJQUFJLDBCQUFlLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUNqQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLENBQUM7U0FDakIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxFQUFFLEdBQUcsSUFBSSw4QkFBYSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUU7WUFDckMsSUFBSSxFQUFFLGNBQWM7WUFDcEIsUUFBUSxFQUFFLFNBQVM7WUFDbkIsSUFBSSxFQUFFO2dCQUNGLFdBQVcsRUFBRSxLQUFLO2FBQ3JCO1NBQ0osQ0FBQyxDQUFDO1FBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSxzQ0FBaUIsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO1lBQzNDLElBQUksRUFBRSxjQUFjO1lBQ3BCLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxJQUFJO1lBQzFCLFFB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QUUsSUFBSTt5QkFDakI7cUJBQ0o7aUJBQ0o7YUFDSjtTQUNKLENBQUMsQ0FBQztRQUdILElBQUksdUJBQWUsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JDLEtBQUssRUFBRSxHQUFHLENBQUMsYUFBYTtTQUMzQixDQUFDLENBQUM7UUFFSCxJQUFJLHVCQUFlLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsV0FBVyxDQUFDLElBQUk7U0FDMUIsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztDQUNKO0FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxXQUFHLEVBQUUsQ0FBQztBQUN0QixJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUNwQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0IHsgQXBwLCBUZXJyYWZvcm1TdGFjaywgVGVycmFmb3JtT3V0cHV0IH0gZnJvbSBcImNka3RmXCI7XG5pbXBvcnQgeyBBenVyZXJtUHJvdmlkZXIgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3Byb3ZpZGVyXCI7XG5pbXBvcnQgeyBSZXNvdXJjZUdyb3VwIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9yZXNvdXJjZS1ncm91cFwiO1xuaW1wb3J0IHsgQ29udGFpbmVyUmVnaXN0cnkgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL2NvbnRhaW5lci1yZWdpc3RyeVwiO1xuaW1wb3J0IHsgS3ViZXJuZXRlc0NsdXN0ZXIgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL2t1YmVybmV0ZXMtY2x1c3RlclwiO1xuaW1wb3J0IHsgUm9sZUFzc2lnbm1lbnQgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL3JvbGUtYXNzaWdubWVudFwiO1xuaW1wb3J0IHsgS3ViZXJuZXRlc1Byb3ZpZGVyIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1rdWJlcm5ldGVzL2xpYi9wcm92aWRlclwiO1xuaW1wb3J0IHsgSGVsbVByb3ZpZGVyIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1oZWxtL2xpYi9wcm92aWRlclwiO1xuaW1wb3J0IHsgTmFtZXNwYWNlIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1rdWJlcm5ldGVzL2xpYi9uYW1lc3BhY2VcIjtcbmltcG9ydCB7IFJlbGVhc2UgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWhlbG0vbGliL3JlbGVhc2VcIjtcbmltcG9ydCB7IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlciB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvcG9zdGdyZXNxbC1mbGV4aWJsZS1zZXJ2ZXJcIjtcbmltcG9ydCB7IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlckRhdGFiYXNlIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9wb3N0Z3Jlc3FsLWZsZXhpYmxlLXNlcnZlci1kYXRhYmFzZVwiO1xuaW1wb3J0IHsgTWFuaWZlc3QgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWt1YmVybmV0ZXMvbGliL21hbmlmZXN0XCI7XG5pbXBvcnQgeyBTdG9yYWdlQWNjb3VudCB9IGZyb20gXCJAY2RrdGYvcHJvdmlkZXItYXp1cmVybS9saWIvc3RvcmFnZS1hY2NvdW50XCI7XG5pbXBvcnQgeyBDZG5Qcm9maWxlIH0gZnJvbSBcIkBjZGt0Zi9wcm92aWRlci1henVyZXJtL2xpYi9jZG4tcHJvZmlsZVwiO1xuaW1wb3J0IHsgQ2RuRW5kcG9pbnQgfSBmcm9tIFwiQGNka3RmL3Byb3ZpZGVyLWF6dXJlcm0vbGliL2Nkbi1lbmRwb2ludFwiO1xuXG5jbGFzcyBNeVN0YWNrIGV4dGVuZHMgVGVycmFmb3JtU3RhY2sge1xuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgICAgICAvLyBHZXQgcmVwb3NpdG9yeSBVUkwgZnJvbSBlbnZpcm9ubWVudCBvciB1c2UgZGVmYXVsdFxuICAgICAgICBjb25zdCByZXBvVXJsID0gcHJvY2Vzcy5lbnYuR0lUSFVCX1JFUE9TSVRPUllfVVJMIHx8IFwiaHR0cHM6Ly9naXRodWIuY29tL3lvdXItb3JnL3JlY2lwZWJveFwiO1xuICAgICAgICBjb25zdCBwZ1Bhc3N3b3JkID0gcHJvY2Vzcy5lbnYuUE9TVEdSRVNfUEFTU1dPUkQgfHwgXCJQQHNzdzByZDEyMyFcIjtcblxuICAgICAgICBuZXcgQXp1cmVybVByb3ZpZGVyKHRoaXMsIFwiQXp1cmVSbVwiLCB7XG4gICAgICAgICAgICBmZWF0dXJlczogW3t9XSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcmcgPSBuZXcgUmVzb3VyY2VHcm91cCh0aGlzLCBcInJnXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IFwicmctcmVjaXBlYm94XCIsXG4gICAgICAgICAgICBsb2NhdGlvbjogXCJFYXN0IFVTXCIsXG4gICAgICAgICAgICB0YWdzOiB7XG4gICAgICAgICAgICAgICAgRW52aXJvbm1lbnQ6IFwiZGV2XCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBhY3IgPSBuZXcgQ29udGFpbmVyUmVnaXN0cnkodGhpcywgXCJhY3JcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJyZWNpcGVib3hhY3JcIixcbiAgICAgICAgICAgIHJlc291cmNlR3JvdXBOYW1lOiByZy5uYW1lLFxuICAgICAgICAgICAgbG9jYXRpb246IHJnLmxvY2F0aW9uLFxuICAgICAgICAgICAgc2t1OiBcIkJhc2ljXCIsXG4gICAgICAgICAgICB0YWdzOiB7XG4gICAgICAgICAgICAgICAgRW52aXJvbm1lbnQ6IFwiZGV2XCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBzdG9yYWdlQWNjb3VudCA9IG5ldyBTdG9yYWdlQWNjb3VudCh0aGlzLCBcInN0b3JhZ2VcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJyZWNpcGVib3hzdG9yYWdlXCIsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIGFjY291bnRUaWVyOiBcIlN0YW5kYXJkXCIsXG4gICAgICAgICAgICBhY2NvdW50UmVwbGljYXRpb25UeXBlOiBcIkxSU1wiLFxuICAgICAgICAgICAgc3RhdGljV2Vic2l0ZToge1xuICAgICAgICAgICAgICAgIGluZGV4RG9jdW1lbnQ6IFwiaW5kZXguaHRtbFwiLFxuICAgICAgICAgICAgICAgIGVycm9yNDA0RG9jdW1lbnQ6IFwiaW5kZXguaHRtbFwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRhZ3M6IHtcbiAgICAgICAgICAgICAgICBFbnZpcm9ubWVudDogXCJkZXZcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNkblByb2ZpbGUgPSBuZXcgQ2RuUHJvZmlsZSh0aGlzLCBcImNkblByb2ZpbGVcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJyZWNpcGVib3gtY2RuXCIsXG4gICAgICAgICAgICBsb2NhdGlvbjogcmcubG9jYXRpb24sXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIHNrdTogXCJTdGFuZGFyZF9NaWNyb3NvZnRcIixcbiAgICAgICAgICAgIHRhZ3M6IHtcbiAgICAgICAgICAgICAgICBFbnZpcm9ubWVudDogXCJkZXZcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNkbkVuZHBvaW50ID0gbmV3IENkbkVuZHBvaW50KHRoaXMsIFwiY2RuRW5kcG9pbnRcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJyZWNpcGVib3gtZnJvbnRlbmRcIixcbiAgICAgICAgICAgIHByb2ZpbGVOYW1lOiBjZG5Qcm9maWxlLm5hbWUsXG4gICAgICAgICAgICBsb2NhdGlvbjogcmcubG9jYXRpb24sXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIG9yaWdpbjogW3tcbiAgICAgICAgICAgICAgICBuYW1lOiBcInJlY2lwZWJveC1vcmlnaW5cIixcbiAgICAgICAgICAgICAgICBob3N0TmFtZTogc3RvcmFnZUFjY291bnQucHJpbWFyeVdlYkhvc3QsXG4gICAgICAgICAgICB9XSxcbiAgICAgICAgICAgIHRhZ3M6IHtcbiAgICAgICAgICAgICAgICBFbnZpcm9ubWVudDogXCJkZXZcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHBnU2VydmVyID0gbmV3IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlcih0aGlzLCBcInBnU2VydmVyXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IFwicmVjaXBlYm94LXBnXCIsXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiByZy5sb2NhdGlvbixcbiAgICAgICAgICAgIHNrdU5hbWU6IFwiQl9TdGFuZGFyZF9CMW1zXCIsXG4gICAgICAgICAgICBzdG9yYWdlTWI6IDMyNzY4LFxuICAgICAgICAgICAgdmVyc2lvbjogXCIxNVwiLFxuICAgICAgICAgICAgYWRtaW5pc3RyYXRvckxvZ2luOiBcInBnYWRtaW5cIixcbiAgICAgICAgICAgIGFkbWluaXN0cmF0b3JQYXNzd29yZDogcGdQYXNzd29yZCxcbiAgICAgICAgICAgIHpvbmU6IFwiMVwiLFxuICAgICAgICAgICAgdGFnczoge1xuICAgICAgICAgICAgICAgIEVudmlyb25tZW50OiBcImRldlwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFBvc3RncmVzcWxGbGV4aWJsZVNlcnZlckRhdGFiYXNlKHRoaXMsIFwicGdEYlwiLCB7XG4gICAgICAgICAgICBuYW1lOiBcInJlY2lwZWJveFwiLFxuICAgICAgICAgICAgc2VydmVySWQ6IHBnU2VydmVyLmlkLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBha3MgPSBuZXcgS3ViZXJuZXRlc0NsdXN0ZXIodGhpcywgXCJha3NcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJyZWNpcGVib3gtYWtzXCIsXG4gICAgICAgICAgICBsb2NhdGlvbjogcmcubG9jYXRpb24sXG4gICAgICAgICAgICByZXNvdXJjZUdyb3VwTmFtZTogcmcubmFtZSxcbiAgICAgICAgICAgIGRuc1ByZWZpeDogXCJyZWNpcGVib3hcIixcbiAgICAgICAgICAgIGRlZmF1bHROb2RlUG9vbDoge1xuICAgICAgICAgICAgICAgIG5hbWU6IFwiZGVmYXVsdFwiLFxuICAgICAgICAgICAgICAgIG5vZGVDb3VudDogMSxcbiAgICAgICAgICAgICAgICB2bVNpemU6IFwiU3RhbmRhcmRfRFMyX3YyXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaWRlbnRpdHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIlN5c3RlbUFzc2lnbmVkXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm9sZUJhc2VkQWNjZXNzQ29udHJvbEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICB0YWdzOiB7XG4gICAgICAgICAgICAgICAgRW52aXJvbm1lbnQ6IFwiZGV2XCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgUm9sZUFzc2lnbm1lbnQodGhpcywgXCJhY3JQdWxsXCIsIHtcbiAgICAgICAgICAgIHNjb3BlOiBhY3IuaWQsXG4gICAgICAgICAgICByb2xlRGVmaW5pdGlvbk5hbWU6IFwiQWNyUHVsbFwiLFxuICAgICAgICAgICAgcHJpbmNpcGFsSWQ6IGFrcy5rdWJlbGV0SWRlbnRpdHkub2JqZWN0SWQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEt1YmVybmV0ZXMgcHJvdmlkZXJcbiAgICAgICAgbmV3IEt1YmVybmV0ZXNQcm92aWRlcih0aGlzLCBcIms4c1wiLCB7XG4gICAgICAgICAgICBob3N0OiBha3Mua3ViZUNvbmZpZy5nZXQoMCkuaG9zdCxcbiAgICAgICAgICAgIGNsaWVudENlcnRpZmljYXRlOiBha3Mua3ViZUNvbmZpZy5nZXQoMCkuY2xpZW50Q2VydGlmaWNhdGUsXG4gICAgICAgICAgICBjbGllbnRLZXk6IGFrcy5rdWJlQ29uZmlnLmdldCgwKS5jbGllbnRLZXksXG4gICAgICAgICAgICBjbHVzdGVyQ2FDZXJ0aWZpY2F0ZTogYWtzLmt1YmVDb25maWcuZ2V0KDApLmNsdXN0ZXJDYUNlcnRpZmljYXRlLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBIZWxtIHByb3ZpZGVyXG4gICAgICAgIG5ldyBIZWxtUHJvdmlkZXIodGhpcywgXCJoZWxtXCIsIHtcbiAgICAgICAgICAgIGt1YmVybmV0ZXM6IHtcbiAgICAgICAgICAgICAgICBob3N0OiBha3Mua3ViZUNvbmZpZy5nZXQoMCkuaG9zdCxcbiAgICAgICAgICAgICAgICBjbGllbnRDZXJ0aWZpY2F0ZTogYWtzLmt1YmVDb25maWcuZ2V0KDApLmNsaWVudENlcnRpZmljYXRlLFxuICAgICAgICAgICAgICAgIGNsaWVudEtleTogYWtzLmt1YmVDb25maWcuZ2V0KDApLmNsaWVudEtleSxcbiAgICAgICAgICAgICAgICBjbHVzdGVyQ2FDZXJ0aWZpY2F0ZTogYWtzLmt1YmVDb25maWcuZ2V0KDApLmNsdXN0ZXJDYUNlcnRpZmljYXRlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQXJnb0NEIG5hbWVzcGFjZVxuICAgICAgICBuZXcgTmFtZXNwYWNlKHRoaXMsIFwiYXJnb2NkLW5zXCIsIHtcbiAgICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJhcmdvY2RcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFyZ29DRCBIZWxtIHJlbGVhc2VcbiAgICAgICAgbmV3IFJlbGVhc2UodGhpcywgXCJhcmdvY2RcIiwge1xuICAgICAgICAgICAgbmFtZTogXCJhcmdvY2RcIixcbiAgICAgICAgICAgIHJlcG9zaXRvcnk6IFwiaHR0cHM6Ly9hcmdvcHJvai5naXRodWIuaW8vYXJnby1oZWxtXCIsXG4gICAgICAgICAgICBjaGFydDogXCJhcmdvLWNkXCIsXG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiYXJnb2NkXCIsXG4gICAgICAgICAgICBzZXQ6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IFwic2VydmVyLnNlcnZpY2UudHlwZVwiLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogXCJMb2FkQmFsYW5jZXJcIixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQXJnb0NEIEFwcGxpY2F0aW9uc1xuICAgICAgICBjb25zdCBhcmdvY2RBcHBOYW1lc3BhY2UgPSBuZXcgTmFtZXNwYWNlKHRoaXMsIFwiYXJnb2NkLWFwcHMtbnNcIiwge1xuICAgICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcImFyZ29jZC1hcHBzXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBSZWNpcGVCb3ggQVBJIEFwcGxpY2F0aW9uXG4gICAgICAgIG5ldyBNYW5pZmVzdCh0aGlzLCBcInJlY2lwZWJveC1hcGktYXBwXCIsIHtcbiAgICAgICAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgICAgICAgICAgYXBpVmVyc2lvbjogXCJhcmdvcHJvai5pby92MWFscGhhMVwiLFxuICAgICAgICAgICAgICAgIGtpbmQ6IFwiQXBwbGljYXRpb25cIixcbiAgICAgICAgICAgICAgICBtZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcInJlY2lwZWJveC1hcGlcIixcbiAgICAgICAgICAgICAgICAgICAgbmFtZXNwYWNlOiBcImFyZ29jZFwiLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc3BlYzoge1xuICAgICAgICAgICAgICAgICAgICBwcm9qZWN0OiBcImRlZmF1bHRcIixcbiAgICAgICAgICAgICAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBvVVJMOiByZXBvVXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogXCJrOHNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFJldmlzaW9uOiBcIkhFQURcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlbG06IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZUZpbGVzOiBbXCJ2YWx1ZXMueWFtbFwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXI6IFwiaHR0cHM6Ly9rdWJlcm5ldGVzLmRlZmF1bHQuc3ZjXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lc3BhY2U6IFwiZGVmYXVsdFwiLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzeW5jUG9saWN5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdXRvbWF0ZWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcnVuZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmSGVhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImt1YmVfY29uZmlnXCIsIHtcbiAgICAgICAgICAgIHZhbHVlOiBha3Mua3ViZUNvbmZpZ1JhdyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IFRlcnJhZm9ybU91dHB1dCh0aGlzLCBcImNkbl9lbmRwb2ludFwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogY2RuRW5kcG9pbnQuZnFkbixcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5jb25zdCBhcHAgPSBuZXcgQXBwKCk7XG5uZXcgTXlTdGFjayhhcHAsIFwicmVjaXBlYm94LWluZnJhXCIpO1xuYXBwLnN5bnRoKCk7Il19