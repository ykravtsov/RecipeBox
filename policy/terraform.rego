package main

import future.keywords.in

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
  some resource_type in ["azurerm_container_registry", "azurerm_kubernetes_cluster", "azurerm_resource_group", "azurerm_storage_account", "azurerm_postgresql_flexible_server", "azurerm_cdn_profile", "azurerm_cdn_endpoint"]
  some resources in input.resource[resource_type]
  some resource in resources

  # Deny if tags is null
  resource.tags == null

  msg := sprintf("Azure resource '%s' of type '%s' is missing the required 'Environment' tag.", [resource.name, resource_type])
}

deny contains msg if {
  # Check all Azure resource types (excluding database which inherits from server)
  some resource_type in ["azurerm_container_registry", "azurerm_kubernetes_cluster", "azurerm_resource_group", "azurerm_storage_account", "azurerm_postgresql_flexible_server", "azurerm_cdn_profile", "azurerm_cdn_endpoint"]
  some resources in input.resource[resource_type]
  some resource in resources

  # Deny if Environment is missing
  env_exists := count([1 | resource.tags.Environment]) > 0
  not env_exists

  msg := sprintf("Azure resource '%s' of type '%s' is missing the required 'Environment' tag.", [resource.name, resource_type])
}

deny contains msg if {
  # Check all Azure resource types (excluding database which inherits from server)
  some resource_type in ["azurerm_container_registry", "azurerm_kubernetes_cluster", "azurerm_resource_group", "azurerm_storage_account", "azurerm_postgresql_flexible_server", "azurerm_cdn_profile", "azurerm_cdn_endpoint"]
  some resources in input.resource[resource_type]
  some resource in resources

  # Deny if Environment is empty
  resource.tags.Environment == ""

  msg := sprintf("Azure resource '%s' of type '%s' is missing the required 'Environment' tag.", [resource.name, resource_type])
}