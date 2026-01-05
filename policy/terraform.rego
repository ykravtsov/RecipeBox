package main

# Deny Azure Container Registry with admin_enabled set to true
deny contains msg if {
  resource := input.resource.azurerm_container_registry[_]
  resource.admin_enabled == true
  msg := sprintf("Azure Container Registry '%s' has admin_enabled set to true. Use Service Principals or Managed Identity instead.", [resource.name])
}

# Deny AKS cluster with role_based_access_control_enabled not set to true
deny contains msg if {
  resource := input.resource.azurerm_kubernetes_cluster[_]
  not resource.role_based_access_control_enabled == true
  msg := sprintf("AKS cluster '%s' must have role_based_access_control_enabled set to true for security.", [resource.name])
}

# Deny any Azure resource missing the Environment tag
deny contains msg if {
  # Check all Azure resource types (excluding database which inherits from server)
  resource_types := ["azurerm_container_registry", "azurerm_kubernetes_cluster", "azurerm_resource_group", "azurerm_storage_account", "azurerm_postgresql_flexible_server", "azurerm_cdn_profile", "azurerm_cdn_endpoint"]
  resource_type := resource_types[_]
  resources := input.resource[resource_type]
  resource := resources[_]

  # Check if tags exist and contain Environment
  not has_environment_tag(resource)

  msg := sprintf("Azure resource '%s' of type '%s' is missing the required 'Environment' tag.", [resource.name, resource_type])
}

# Helper function to check if resource has Environment tag
has_environment_tag(resource) if {
  resource.tags != null
  resource.tags.Environment != null
  resource.tags.Environment != ""
}