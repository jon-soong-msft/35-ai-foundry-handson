// ============================================================================
// Foundry Playground — subscription-scoped entrypoint.
//
// Creates the requested resource group (rg-foundry-playground) and delegates all
// resources to resources.bicep at resource-group scope. Subscription scope is used
// so the resource-group NAME can be fixed regardless of the azd environment name.
// ============================================================================
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('azd environment name; used for tags and to derive globally-unique resource names.')
param environmentName string

@minLength(1)
@description('Azure region for every resource (workshop verified in Southeast Asia).')
param location string

@description('Object ID of the principal running the deployment. azd auto-populates AZURE_PRINCIPAL_ID. Granted data-plane access so the Foundry playground works immediately.')
param principalId string = ''

@allowed(['User', 'ServicePrincipal', 'Group'])
@description('Principal type of principalId (User for local azd up, ServicePrincipal for CI).')
param principalType string = 'User'

// ---- Model configuration (override with `azd env set <NAME> <value>`) ----
@description('Chat model to deploy for the acl-remedy-advisor agent.')
param chatModelName string = 'gpt-5'
param chatModelVersion string = '2025-08-07'
param chatModelSku string = 'GlobalStandard'
@description('Chat model capacity in thousands of tokens-per-minute.')
param chatModelCapacity int = 50

@description('Embedding model to deploy for grounding / Foundry IQ (Module 07).')
param embeddingModelName string = 'text-embedding-3-large'
param embeddingModelVersion string = '1'
param embeddingModelSku string = 'GlobalStandard'
param embeddingModelCapacity int = 50

@description('Also deploy Azure AI Search and connect it to the project (Module 07 Foundry IQ / Path B).')
param deployAiSearch bool = true

@description('Fixed resource group name requested for the playground.')
param resourceGroupName string = 'rg-foundry-playground'

var tags = {
  'azd-env-name': environmentName
  workload: 'foundry-playground'
}

resource rg 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  name: 'foundry-playground-resources'
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
    principalId: principalId
    principalType: principalType
    chatModelName: chatModelName
    chatModelVersion: chatModelVersion
    chatModelSku: chatModelSku
    chatModelCapacity: chatModelCapacity
    embeddingModelName: embeddingModelName
    embeddingModelVersion: embeddingModelVersion
    embeddingModelSku: embeddingModelSku
    embeddingModelCapacity: embeddingModelCapacity
    deployAiSearch: deployAiSearch
  }
}

// azd surfaces these as environment values (azd env get-values).
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_AI_ACCOUNT_NAME string = resources.outputs.foundryAccountName
output AZURE_AI_PROJECT_NAME string = resources.outputs.foundryProjectName
output AZURE_AI_PROJECT_ENDPOINT string = resources.outputs.foundryProjectEndpoint
output AZURE_AI_SERVICES_ENDPOINT string = resources.outputs.foundryAccountEndpoint
output AZURE_AI_CHAT_DEPLOYMENT string = resources.outputs.chatDeploymentName
output AZURE_AI_EMBEDDING_DEPLOYMENT string = resources.outputs.embeddingDeploymentName
output AZURE_AI_SEARCH_ENDPOINT string = resources.outputs.searchEndpoint
output APPLICATIONINSIGHTS_CONNECTION_STRING string = resources.outputs.appInsightsConnectionString
output APPLICATIONINSIGHTS_NAME string = resources.outputs.appInsightsName
output LOG_ANALYTICS_WORKSPACE_NAME string = resources.outputs.logAnalyticsName
