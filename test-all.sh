#!/bin/bash

set -e

echo "Running Policy as Code tests..."

# Generate CDKTF infrastructure JSON
echo "Synthesizing CDKTF infrastructure..."
cd infra
cdktf get
NODE_OPTIONS="--max-old-space-size=6144" cdktf synth
cd ..

# Test CDKTF infrastructure with Rego policies
echo "Testing CDKTF infrastructure policies..."
conftest test infra/cdktf.out/stacks/recipebox-infra/ -p policy/terraform.rego

# Test ArgoCD Application manifests with Rego policies
echo "Testing ArgoCD Application policies..."
conftest test k8s/ -p policy/argocd.rego

# Run existing Helm chart tests
echo "Running Helm chart tests..."
helm lint k8s/

echo "All tests passed!"