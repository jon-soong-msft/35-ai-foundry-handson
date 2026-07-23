// ============================================================================
// Foundry Playground — all resources (resource-group scope).
//
// Provisions, for the portal-first Microsoft Foundry agent workshop:
//   - Log Analytics workspace + workspace-based Application Insights
//   - Microsoft Foundry (AI Services) account with project management enabled
//   - A Foundry project
//   - Chat (gpt-5) + embedding (text-embedding-3-large) model deployments
//   - Project -> Application Insights connection  (enables Traces/Monitor tabs)
//   - Optional Azure AI Search + project connection (Module 07 Foundry IQ)
//   - Least-privilege RBAC so the playground and Search integration work keyless
//
// Security notes:
//   - System-assigned managed identities on the account, project, and Search.
//   - Search is reached from the project via Entra ID (AAD) auth, not keys.
//   - The deploying user gets data-plane roles so the portal playground works now.
// ============================================================================
targetScope = 'resourceGroup'

@description('Azure region for every resource.')
param location string
@description('Tags applied to every resource.')
param tags object
@description('azd environment name; feeds the unique resource token.')
param environmentName string
@description('Principal to grant data-plane access (empty = skip).')
param principalId string = ''
@allowed(['User', 'ServicePrincipal', 'Group'])
param principalType string = 'User'

param chatModelName string
param chatModelVersion string
param chatModelSku string
param chatModelCapacity int
param embeddingModelName string
param embeddingModelVersion string
param embeddingModelSku string
param embeddingModelCapacity int
param deployAiSearch bool
@description('Region for Azure AI Search (may differ from main location due to SKU capacity).')
param searchLocation string = 'eastasia'

// Stable, globally-unique token for names that must be unique (account subdomain, Search).
var resourceToken = toLower(uniqueString(subscription().id, resourceGroup().id, environmentName))
var foundryAccountName = 'aifdy${resourceToken}'
var foundryProjectName = 'proj-foundry-playground'
var searchName = 'srch-fdy-${resourceToken}'
var logAnalyticsName = 'log-foundry-playground'
var appInsightsName = 'appi-foundry-playground'

// Built-in role definition IDs (verified against this tenant).
var roleAzureAIDeveloper = '64702f94-c441-49e6-a78b-ef80e0188fee'
var roleCognitiveServicesOpenAIUser = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
var roleSearchIndexDataReader = '1407120a-92aa-4202-b7e9-c0e197c71c8f'
var roleSearchServiceContributor = '7ca78c08-252a-4471-8644-bb5ff32d4ba0'

// ---------------------------------------------------------------------------
// Log Analytics workspace — backing store for workspace-based Application Insights.
// ---------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}

// ---------------------------------------------------------------------------
// Application Insights (workspace-based) — receives Foundry agent traces.
// ---------------------------------------------------------------------------
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ---------------------------------------------------------------------------
// Microsoft Foundry (AI Services) account.
// allowProjectManagement:true makes it a "New Foundry" account that hosts projects.
// customSubDomainName is required for Entra ID token auth and the project endpoint.
// ---------------------------------------------------------------------------
resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: foundryAccountName
  location: location
  tags: tags
  kind: 'AIServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    allowProjectManagement: true
    customSubDomainName: foundryAccountName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// ---------------------------------------------------------------------------
// Foundry project — the workspace that holds agents, tools, knowledge, evals.
// ---------------------------------------------------------------------------
resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: foundryAccount
  name: foundryProjectName
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    displayName: 'Foundry Playground'
    description: 'Playground project for the portal-first Microsoft Foundry agent workshop.'
  }
}

// ---------------------------------------------------------------------------
// Model deployments. Cognitive Services allows only one deployment operation at a
// time, so the embedding deployment is serialized after the chat deployment.
// ---------------------------------------------------------------------------
resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: foundryAccount
  name: chatModelName
  sku: { name: chatModelSku, capacity: chatModelCapacity }
  properties: {
    model: { format: 'OpenAI', name: chatModelName, version: chatModelVersion }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: foundryAccount
  name: embeddingModelName
  sku: { name: embeddingModelSku, capacity: embeddingModelCapacity }
  properties: {
    model: { format: 'OpenAI', name: embeddingModelName, version: embeddingModelVersion }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
  dependsOn: [ chatDeployment ]
}

// ---------------------------------------------------------------------------
// Project -> Application Insights connection.
// This is the piece the portal Traces/Monitor tabs read to surface agent telemetry.
// ---------------------------------------------------------------------------
resource appInsightsConnection 'Microsoft.CognitiveServices/accounts/projects/connections@2025-06-01' = {
  parent: foundryProject
  name: 'appinsights'
  properties: {
    category: 'AppInsights'
    target: appInsights.id
    authType: 'ApiKey'
    isSharedToAll: true
    metadata: {
      ApiType: 'Azure'
      ResourceId: appInsights.id
    }
    credentials: {
      key: appInsights.properties.ConnectionString
    }
  }
}

// ---------------------------------------------------------------------------
// Azure AI Search (optional) + project connection over Entra ID (keyless).
// ---------------------------------------------------------------------------
resource search 'Microsoft.Search/searchServices@2025-05-01' = if (deployAiSearch) {
  name: searchName
  location: searchLocation
  tags: tags
  sku: { name: 'basic' }
  identity: { type: 'SystemAssigned' }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'Default'
    publicNetworkAccess: 'enabled'
    semanticSearch: 'free'
    authOptions: {
      aadOrApiKey: { aadAuthFailureMode: 'http401WithBearerChallenge' }
    }
  }
}

resource searchConnection 'Microsoft.CognitiveServices/accounts/projects/connections@2025-06-01' = if (deployAiSearch) {
  parent: foundryProject
  name: 'aisearch'
  properties: {
    category: 'CognitiveSearch'
    target: 'https://${searchName}.search.windows.net'
    authType: 'AAD'
    isSharedToAll: true
    metadata: {
      ApiType: 'Azure'
      ResourceId: search!.id
      Location: searchLocation
    }
  }
}

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

// Deploying user -> build & use agents in the project (data plane).
resource userAiDeveloper 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(foundryAccount.id, principalId, roleAzureAIDeveloper)
  scope: foundryAccount
  properties: {
    principalId: principalId
    principalType: principalType
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAzureAIDeveloper)
  }
}

// Deploying user -> call the deployed models (playground) via Entra ID.
resource userOpenAIUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(foundryAccount.id, principalId, roleCognitiveServicesOpenAIUser)
  scope: foundryAccount
  properties: {
    principalId: principalId
    principalType: principalType
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleCognitiveServicesOpenAIUser)
  }
}

// Project managed identity -> query Search indexes at runtime.
resource projSearchReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployAiSearch) {
  name: guid(search!.id, foundryProject.id, roleSearchIndexDataReader)
  scope: search
  properties: {
    principalId: foundryProject.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleSearchIndexDataReader)
  }
}

// Project managed identity -> list/manage Search indexes (Foundry IQ knowledge base).
resource projSearchServiceContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployAiSearch) {
  name: guid(search!.id, foundryProject.id, roleSearchServiceContributor)
  scope: search
  properties: {
    principalId: foundryProject.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleSearchServiceContributor)
  }
}

// Search managed identity -> use the embedding model for integrated vectorization.
resource searchOpenAIUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployAiSearch) {
  name: guid(foundryAccount.id, search!.id, roleCognitiveServicesOpenAIUser)
  scope: foundryAccount
  properties: {
    principalId: search!.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleCognitiveServicesOpenAIUser)
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
output foundryAccountName string = foundryAccount.name
output foundryAccountEndpoint string = foundryAccount.properties.endpoint
output foundryProjectName string = foundryProject.name
output foundryProjectEndpoint string = 'https://${foundryAccount.name}.services.ai.azure.com/api/projects/${foundryProject.name}'
output chatDeploymentName string = chatDeployment.name
output embeddingDeploymentName string = embeddingDeployment.name
output appInsightsName string = appInsights.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output logAnalyticsName string = logAnalytics.name
output searchEndpoint string = deployAiSearch ? 'https://${searchName}.search.windows.net' : ''
