package main

# Deny ArgoCD Application using default project
deny contains msg if {
  input.kind == "Application"
  input.apiVersion == "argoproj.io/v1alpha1"
  input.spec.project == "default"
  msg := sprintf("ArgoCD Application '%s' uses 'default' project. Applications must use specific projects for isolation.", [input.metadata.name])
}

# Warn if ArgoCD Application does not have self-healing enabled
warn contains msg if {
  input.kind == "Application"
  input.apiVersion == "argoproj.io/v1alpha1"
  not input.spec.syncPolicy.automated.selfHeal == true
  msg := sprintf("ArgoCD Application '%s' does not have self-healing enabled. Consider enabling automated.selfHeal for drift correction.", [input.metadata.name])
}
