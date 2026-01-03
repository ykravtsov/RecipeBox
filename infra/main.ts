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

class MyStack extends TerraformStack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // Get repository URL from environment or use default
        const repoUrl = process.env.GITHUB_REPOSITORY_URL || "https://github.com/your-org/recipebox";
        const pgPassword = process.env.POSTGRES_PASSWORD || "P@ssw0rd123!";

        new AzurermProvider(this, "AzureRm", {
            features: {},
        });

        const rg = new ResourceGroup(this, "rg", {
            name: "rg-recipebox",
            location: "East US",
        });

        const acr = new ContainerRegistry(this, "acr", {
            name: "recipeboxacr",
            resourceGroupName: rg.name,
            location: rg.location,
            sku: "Basic",
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
        });

        const cdnProfile = new CdnProfile(this, "cdnProfile", {
            name: "recipebox-cdn",
            location: rg.location,
            resourceGroupName: rg.name,
            sku: "Standard_Microsoft",
        });

        const cdnEndpoint = new CdnEndpoint(this, "cdnEndpoint", {
            name: "recipebox-frontend",
            profileName: cdnProfile.name,
            location: rg.location,
            resourceGroupName: rg.name,
            origin: {
                name: "recipebox-origin",
                hostName: storageAccount.primaryWebHost,
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
            },
            identity: {
                type: "SystemAssigned",
            },
        });

        new RoleAssignment(this, "acrPull", {
            scope: acr.id,
            roleDefinitionName: "AcrPull",
            principalId: aks.kubeletIdentity.objectId,
        });

        // Kubernetes provider
        new KubernetesProvider(this, "k8s", {
            host: aks.host,
            clientCertificate: aks.clientCertificate,
            clientKey: aks.clientKey,
            clusterCaCertificate: aks.clusterCaCertificate,
        });

        // Helm provider
        new HelmProvider(this, "helm", {
            kubernetes: {
                host: aks.host,
                clientCertificate: aks.clientCertificate,
                clientKey: aks.clientKey,
                clusterCaCertificate: aks.clusterCaCertificate,
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

        // RecipeBox API Application
        new Manifest(this, "recipebox-api-app", {
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


        new TerraformOutput(this, "kube_config", {
            value: aks.kubeConfigRaw,
        });

        new TerraformOutput(this, "cdn_endpoint", {
            value: cdnEndpoint.hostName,
        });
    }
}

const app = new App();
new MyStack(app, "recipebox-infra");
app.synth();