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

class MyStack extends TerraformStack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

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

        new TerraformOutput(this, "kube_config", {
            value: aks.kubeConfigRaw,
        });
    }
}

const app = new App();
new MyStack(app, "recipebox-infra");
app.synth();