// Force rebuild 3
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
import { Manifest } from "@cdktf/provider-kubernetes/lib/manifest";
import { StorageAccount } from "@cdktf/provider-azurerm/lib/storage-account";
import { CdnProfile } from "@cdktf/provider-azurerm/lib/cdn-profile";
import { CdnEndpoint } from "@cdktf/provider-azurerm/lib/cdn-endpoint";

// Force initial build trigger

class MyStack extends TerraformStack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // Get repository URL from environment or use default
        const repoUrl = process.env.GITHUB_REPOSITORY_URL || "https://github.com/your-org/recipebox";
        const pgPassword = process.env.POSTGRES_PASSWORD || "P@ssw0rd123!";

        new AzurermProvider(this, "AzureRm", {
            features: [{}],
            subscriptionId: process.env.ARM_SUBSCRIPTION_ID,
            tenantId: process.env.ARM_TENANT_ID,
            clientId: process.env.ARM_CLIENT_ID,
            clientSecret: process.env.ARM_CLIENT_SECRET,
        });

        const rg = new ResourceGroup(this, "rg", {
            name: "rg-recipebox",
            location: "East US",
            tags: {
                Environment: "dev",
            },
        });

        const acr = new ContainerRegistry(this, "acr", {
            name: "recipeboxacr",
            resourceGroupName: rg.name,
            location: rg.location,
            sku: "Basic",
            tags: {
                Environment: "dev",
            },
        });

        const storageAccount = new StorageAccount(this, "storage", {
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

        const cdnProfile = new CdnProfile(this, "cdnProfile", {
            name: "recipebox-cdn",
            location: rg.location,
            resourceGroupName: rg.name,
            sku: "Standard_Microsoft",
            tags: {
                Environment: "dev",
            },
        });

        const cdnEndpoint = new CdnEndpoint(this, "cdnEndpoint", {
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

        const pgServer = new PostgresqlFlexibleServer(this, "pgServer", {
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

        new PostgresqlFlexibleServerDatabase(this, "pgDb", {
            name: "recipebox",
            serverId: pgServer.id,
        });

        const aks = new KubernetesCluster(this, "aks", {
            name: "recipebox-aks",
            location: rg.location,
            resourceGroupName: rg.name,
            dnsPrefix: "recipebox",
            defaultNodePool: {
                name: "default",
                nodeCount: 1,
                vmSize: "Standard_DS2_v2",
                tags: {
                    Environment: "Development",
                },
            },
            identity: {
                type: "SystemAssigned",
            },
            roleBasedAccessControlEnabled: true,
            tags: {
                Environment: "dev",
            },
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

        // ArgoCD Applications
        const argocdAppNamespace = new Namespace(this, "argocd-apps-ns", {
            metadata: {
                name: "argocd-apps",
            },
        });

        // RecipeBox Backend Application
        new Manifest(this, "recipebox-backend-app", {
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


        new TerraformOutput(this, "kube_config", {
            value: aks.kubeConfigRaw,
        });

        new TerraformOutput(this, "cdn_endpoint", {
            value: cdnEndpoint.fqdn,
        });
    }
}

const app = new App();
new MyStack(app, "recipebox-infra");
app.synth();