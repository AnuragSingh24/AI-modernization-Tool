function formatDependencies(dependencies) {
  const entries = Object.entries(dependencies);

  if (entries.length === 0) {
    return "- None detected";
  }

  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, version]) => `- ${name}: ${version}`)
    .join("\n");
}

const implementationVerificationRule =
  "Run the code and if it is not working then fix it without changing any functionality of it; test the API also.";

function formatRoutes(analysis) {
  if (analysis.apiRoutes.length === 0) {
    return "- No Express or Spring-style routes detected";
  }

  return analysis.apiRoutes
    .map((route) => `- ${route.method} ${route.path} (${route.filePath}${route.framework ? `, ${route.framework}` : ""})`)
    .join("\n");
}

function getDependencyNames(analysis) {
  return Array.from(
    new Set(
      [
        ...analysis.packageJsons.flatMap((pkg) => [
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}),
        ]),
        ...(analysis.javaBuildFiles ?? []).flatMap((buildFile) => buildFile.dependencies ?? []),
      ],
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function hasDependency(analysis, names) {
  const dependencySet = new Set(getDependencyNames(analysis).map((name) => name.toLowerCase()));
  return names.some((name) => dependencySet.has(name.toLowerCase()));
}

function inferPersistenceNotes(analysis) {
  if (hasDependency(analysis, ["mongoose", "mongodb", "pg", "mysql", "mysql2", "sqlite3", "prisma", "sequelize", "typeorm"])) {
    return "- A persistence dependency was detected, so map existing entities, repository access patterns, and migration scripts into the target stack's persistence layer.";
  }

  return "- No obvious database dependency was detected. Treat current runtime state, extracted text buffers, and request payloads as the primary data model unless deeper storage code is found later.";
}

function formatRouteValidationRules(analysis) {
  if (analysis.apiRoutes.length === 0) {
    return "- Define request and response validation rules from business requirements because no API routes were detected automatically.";
  }

  return analysis.apiRoutes
    .map(
      (route) =>
        `- ${route.method} ${route.path}: validate required request fields, reject malformed payloads, and return stable error codes for contract violations.`,
    )
    .join("\n");
}

function formatLocation(item) {
  if (!item?.filePath) {
    return "source location unknown";
  }

  return item.line ? `${item.filePath}:${item.line}` : item.filePath;
}

function formatSecurityFindings(analysis) {
  const findings = analysis.configuration?.securityFindings ?? [];

  if (findings.length === 0) {
    return "- No hardcoded sensitive fallback values were detected by static analysis. Still verify secrets during implementation.";
  }

  return findings
    .map(
      (finding) =>
        `- ${finding.variableName} in ${formatLocation(finding)}: ${finding.recommendation}`,
    )
    .join("\n");
}

function formatEnvironmentVariables(analysis) {
  const variables = analysis.configuration?.environmentVariables ?? [];

  if (variables.length === 0) {
    return "- No environment-variable usage was detected automatically.";
  }

  return variables
    .map(
      (variable) =>
        `- ${variable.name}${variable.sensitive ? " (sensitive)" : ""}: preserve configuration name and load from environment only (${formatLocation(variable)}).`,
    )
    .join("\n");
}

function formatEnvFileEntries(analysis) {
  const entries = analysis.configuration?.envFileEntries ?? [];

  if (entries.length === 0) {
    return "- No uploaded-project .env entries were detected.";
  }

  return entries
    .map((entry) => {
      const value = entry.value || "(empty)";
      const sensitivity = entry.sensitive ? "sensitive, redacted when real" : "non-sensitive";
      const limit = entry.limitLike ? ", limit/size/token-related" : "";

      return `- ${entry.name}=\`${value}\` (${sensitivity}${limit}; ${formatLocation(entry)}).`;
    })
    .join("\n");
}

function formatTokenAndSizeLimits(analysis) {
  const limits = analysis.configuration?.tokenAndSizeLimits ?? [];

  if (limits.length === 0) {
    return "- No token, context, timeout, chunk, upload, body-size, or top-k settings were detected from env files or env-backed code defaults.";
  }

  return limits
    .map(
      (limit) =>
        `- ${limit.name}=\`${limit.value || "(empty)"}\` from ${limit.source} (${formatLocation(limit)}).`,
    )
    .join("\n");
}

function formatRequestLimits(analysis) {
  const bodyLimits = analysis.requestLimits?.bodyLimits ?? [];
  const uploadFields = analysis.requestLimits?.uploadFields ?? [];
  const uploadLimits = analysis.requestLimits?.uploadLimits ?? [];
  const lines = [
    ...bodyLimits.map((item) => `- JSON/body parser limit: ${item.value} (${formatLocation(item)}).`),
    ...uploadFields.map((item) => `- Multipart upload field name: \`${item.fieldName}\` (${formatLocation(item)}).`),
    ...uploadLimits.map((item) => `- Upload/file size limit expression: \`${item.expression}\` (${formatLocation(item)}).`),
  ];

  return lines.length ? lines.join("\n") : "- No explicit request body or upload limits were detected automatically.";
}

function formatAuthFindings(analysis) {
  const hints = analysis.auth?.hints ?? [];
  const localStorageKeys = analysis.auth?.localStorageKeys ?? [];
  const lines = [
    ...hints.map((item) => `- ${item.name}: ${item.detail} (${item.filePath}).`),
    ...localStorageKeys.map(
      (item) => `- Browser token storage key: \`${item.key}\` from ${item.variableName} (${formatLocation(item)}).`,
    ),
  ];

  return lines.length ? lines.join("\n") : "- No authentication/session implementation details were detected automatically.";
}

function formatPersistenceFindings(analysis) {
  const collections = analysis.persistence?.collections ?? [];
  const storageArtifacts = analysis.persistence?.storageArtifacts ?? [];
  const lines = [
    ...collections.map((item) => `- ${item.kind}: \`${item.name}\` (${formatLocation(item)}).`),
    ...storageArtifacts.map((item) => `- Filesystem artifact: \`${item.name}\` (${formatLocation(item)}).`),
  ];

  return lines.length
    ? lines.join("\n")
    : "- No database collections, ORM models, or filesystem artifact names were detected automatically.";
}

function formatApiContractHints(analysis) {
  const hints = analysis.apiContractHints ?? [];

  if (hints.length === 0) {
    return "- No source-level request/response field hints were detected. Capture route fixtures before implementation.";
  }

  return hints
    .map((hint) => {
      const parts = [];

      if (hint.bodyFields?.length) parts.push(`body fields: ${hint.bodyFields.join(", ")}`);
      if (hint.pathParams?.length) parts.push(`path params: ${hint.pathParams.join(", ")}`);
      if (hint.queryParams?.length) parts.push(`query params: ${hint.queryParams.join(", ")}`);
      if (hint.statusCodes?.length) parts.push(`status codes: ${hint.statusCodes.join(", ")}`);
      if (hint.responseKeys?.length) parts.push(`response keys: ${hint.responseKeys.join(", ")}`);

      return `- ${hint.filePath}: ${parts.join("; ")}`;
    })
    .join("\n");
}

function isDependencyRegistryNoise(integration) {
  const fileName = String(integration.filePath ?? "").toLowerCase();
  const name = String(integration.name ?? "").toLowerCase();

  return (
    /(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lock|composer\.lock|poetry\.lock|pipfile\.lock|cargo\.lock|gemfile\.lock|go\.sum)$/.test(
      fileName,
    ) ||
    /(?:registry\.npmjs\.org|registry\.yarnpkg\.com|repo\.maven\.apache\.org|files\.pythonhosted\.org|rubygems\.org|crates\.io)\//.test(
      name,
    )
  );
}

function formatExternalIntegrationPlan(analysis) {
  const integrations = (analysis.externalIntegrations ?? []).filter(
    (integration) => !isDependencyRegistryNoise(integration),
  );

  if (integrations.length === 0) {
    return "";
  }

  const lines = integrations.map((integration) => {
    const location = integration.line
      ? ` (${integration.filePath}:${integration.line})`
      : integration.filePath
        ? ` (${integration.filePath})`
        : "";
    const dependency = integration.dependency ? ` via \`${integration.dependency}\`` : "";
    const provider = integration.provider ? `, provider: ${integration.provider}` : "";

    return `- ${integration.name}${dependency}${provider}${location}: preserve configuration, request/response contracts, timeout/error behavior, and secrets handling in the target implementation.`;
  });

  return `\n\n### AI and Third-Party API Implementation Notes\n\n${lines.join("\n")}`;
}

function buildImplementationDetailsSection(analysis, targetStack) {
  const frontendLine = analysis.stack.hasReact
    ? "- Frontend implementation should keep the existing React component tree, CSS classes, visible copy, page layout, and API call behavior intact while applying only target-version compatibility edits."
    : "- Frontend implementation should preserve the detected UI surface and page workflows exactly, translating files only when the target stack requires a one-to-one framework or language change.";

  const backendLine = targetStack.toLowerCase().includes("spring")
    ? "- Backend implementation should split each Express route into Spring Boot controller, service, DTO, and exception-handling layers, with one controller method per contract endpoint."
    : `- Backend implementation should rebuild the API surface in ${targetStack}, separating transport logic, business logic, and infrastructure concerns into clear modules.`;

  return `## Deep Implementation Details

- Start with a route-by-route implementation backlog derived from the detected API inventory.
${backendLine}
${frontendLine}
- Replace shared mutable runtime state with explicit services or persistence abstractions where needed.
- Create one migration checklist per endpoint covering input schema, processing logic, output schema, failure modes, and observability hooks.
- Preserve existing external dependency behavior first, then refactor internals once parity tests are passing.

### API Contract Capture

${formatApiContractHints(analysis)}

For every route, capture the mounted/full path, auth requirements, request body/query/path fields, multipart fields, response keys, status codes, and known error messages before changing implementation internals.

### Configuration and Secret Handling

${formatEnvironmentVariables(analysis)}

Uploaded-project .env entries:
${formatEnvFileEntries(analysis)}

Token, context, timeout, chunk, upload, body-size, and retrieval limits:
${formatTokenAndSizeLimits(analysis)}

${formatSecurityFindings(analysis)}

Never copy actual secret values into the target codebase, logs, tests, or generated documentation.

### Auth and Session Parity

${formatAuthFindings(analysis)}

### Request Limits and Upload Contracts

${formatRequestLimits(analysis)}

### Persistence and Storage Notes

${formatPersistenceFindings(analysis)}

Keep database-backed data, filesystem-backed artifacts, and request/transient state separate in the target design. Do not add debug/session persistence unless the source has an explicit store for it.${formatExternalIntegrationPlan(analysis)}`;
}

function buildParityContractSection() {
  return `## UI and Functionality Parity Contract

- Separation rule: generate implementation detail for logic, APIs, flows, validation, and behavior, but derive UI implementation detail only from the original-code UI reference.
- UI preservation: keep the current visual layout, CSS class names, component boundaries, visible text, form fields, buttons, navigation, loading states, empty states, and error displays unchanged.
- Text preservation: keep headings, labels, button/link copy, placeholders, aria labels, alt/title text, loading text, empty states, validation messages, and error copy unchanged.
- CSS preservation: keep original stylesheets, selectors, CSS variables, class names, utility classes, media queries, colors, typography, spacing, shadows, border radii, and asset references unchanged unless a target build-tool compatibility change is documented.
- Workflow preservation: every existing user action should produce the same visible result before and after modernization.
- API preservation: keep endpoint paths, HTTP methods, request payloads, response payloads, status codes, and user-facing error messages compatible with the current implementation.
- Allowed changes: update language versions, framework versions, runtime versions, package versions, build configuration, type definitions, and internal backend layering required by the target stack.
- Disallowed changes: do not add features, redesign screens, rename labels, change user flows, introduce unrelated persistence, alter business rules, or replace UI behavior for convenience.
- Any unavoidable compatibility adjustment must be documented with the exact reason, affected file, expected before/after behavior, and a parity test proving the behavior remains equivalent.`;
}

function buildUiReferenceSection(uiReference) {
  return (
    uiReference?.markdown ??
    `## UI Reference Extracted from Original Code

- No extracted UI reference was available for this generation.
- Before frontend implementation, inspect the original code and record component structure, layout hierarchy, CSS/Tailwind/classes, theme colors, typography, spacing, icons, button/input styles, and responsive behavior.
- Do not create or infer a replacement UI until that original-code reference exists.`
  );
}

function buildUiPreservationPlanSection() {
  return `## UI Preservation Implementation Plan

- Start from the "UI Reference Extracted from Original Code" section. It is the UI source of truth for component structure, layout hierarchy, classes, theme colors, typography, spacing, icons, button/input styles, and responsive behavior.
- Treat the "Visible UI Text" subsection as an exact copy contract. Do not rewrite copy, labels, placeholders, aria labels, alt text, loading messages, empty states, validation messages, or error text.
- Inventory any missing legacy UI source files before implementation: templates, React/Vue/Svelte/JSP views, CSS/SCSS/LESS files, theme variables, fonts, images, icons, and public assets.
- Copy existing global styles, theme files, fonts, images, and icons into the target frontend first. Keep selector names, class names, CSS variable names, media queries, colors, spacing, typography, and asset references unchanged.
- Translate each legacy screen or component one-to-one into the target framework only where required. Preserve DOM hierarchy, form fields, table columns, labels, button text, navigation order, loading states, empty states, and error text.
- Reuse the old CSS directly whenever possible. Add new styles only as compatibility glue for imports, build tooling, or framework-specific wrappers, and document every new selector.
- Map every legacy UI file to its target location in the migration backlog so the implementation team can verify that no screen, stylesheet, or asset was dropped.
- Capture before/after screenshots for each migrated page and compare them with visual regression tooling. Any visual drift must be treated as a defect unless it is explicitly approved as a compatibility-only change.`;
}

function buildNonFunctionalRequirementsSection(analysis) {
  return `## Non-Functional Requirements

- Availability: the migrated service should handle the current workload with graceful failure handling and predictable restart behavior.
- Reliability: API responses should be deterministic for the same input, with clear error handling around network, parsing, and downstream failures.
- Security: validate untrusted URLs, sanitize input payloads, rotate any committed-looking secrets, and avoid exposing internal stack traces or raw exception messages.
- Secret management: all sensitive values must come from environment/configuration providers; no API keys, tokens, passwords, or private keys may have real hardcoded fallbacks.
- Environment parity: document every uploaded-project .env entry and env-backed code default. Redact sensitive values, but preserve non-secret operational values such as ports, model names, token limits, context windows, chunk sizes, timeouts, top-k values, and upload/body size limits.
- Request safety: preserve detected body limits, multipart field names, upload size limits, and timeout behavior unless a compatibility note explains the change.
- Observability: add structured logs, request identifiers, error categories, and latency measurement for each API endpoint.
- Maintainability: separate configuration, business logic, validation, and transport concerns so future changes stay localized.
- Compatibility: preserve the current API contract and output shape unless a deliberate versioned change is introduced.
- Operability: document runtime environment variables, startup commands, health checks, and deployment rollback steps.
- Scalability: avoid global in-memory request state that can break under concurrent usage or multi-instance deployment.
- Storage safety: document and test every database collection, ORM model, filesystem artifact, upload directory, and generated file used by the source project.
- Source coverage note: current analysis scanned ${analysis.summary.fileCount} files and ${analysis.apiRoutes.length} detected routes, so deeper hidden runtime behavior should still be validated during implementation.`;
}

function buildArchitectureDecisionsSection(analysis, targetStack) {
  return `## Architecture Decisions

- ADR-1: keep the system as a modular monolith to reduce operational overhead and accelerate delivery.
- ADR-2: preserve the current externally visible API behavior before introducing optimization or structural redesign.
- ADR-3: use explicit controller and service boundaries so parsing, integration, and response formatting remain testable.
- ADR-4: centralize configuration and environment handling instead of scattering runtime constants through handlers.
- ADR-5: prefer typed request and response contracts in the target stack to reduce migration ambiguity.
- ADR-6: use ${targetStack} as the target platform so the new implementation aligns with the requested stack and long-term maintainability goals.
- ADR-7: eliminate implicit global state where possible because it limits concurrency, horizontal scaling, and test isolation in the current code shape.`;
}

function buildValidationRulesSection(analysis) {
  return `## Validation Rules

${formatRouteValidationRules(analysis)}
- Source-level contract hints to preserve:
${formatApiContractHints(analysis)}
- Request size and multipart constraints to preserve:
${formatRequestLimits(analysis)}
- Environment and token/size limits to preserve:
${formatTokenAndSizeLimits(analysis)}
- Validate content type and payload shape before invoking business logic.
- For URL-driven extraction flows, allow only supported protocols and reject empty, malformed, or private-network-only targets unless explicitly permitted.
- Apply size and timeout guards to remote fetches and extraction jobs.
- Normalize error responses into a predictable schema with status, code, and user-safe message fields.
- Add validation for configuration values at startup so missing environment variables fail fast.`;
}

function buildDeploymentDetailsSection(targetStack) {
  const backendRuntime = targetStack.toLowerCase().includes("spring")
    ? "- Package the backend as a Spring Boot service with environment-driven configuration and profile-based deployment settings."
    : `- Package the backend for ${targetStack} using environment-driven configuration and a repeatable build artifact.`;

  return `## Deployment Details

${backendRuntime}
- Build the frontend as static assets and deploy it separately from the backend unless an integrated serving model is intentionally chosen.
- Define environment variables for API base URLs, CORS origins, timeout settings, external service credentials, and logging configuration.
- Preserve and document uploaded-project environment settings, including token/context limits, model names, timeout values, chunk sizes, retrieval top-k values, ports, body limits, and upload limits; secret values must be supplied by the deployment environment and never hardcoded.
- Add health endpoints, readiness checks, and startup validation before production rollout.
- Use at least dev, staging, and production environments with documented promotion steps.
- Include rollback instructions covering previous artifact restore, config rollback, and smoke-test verification after redeploy.`;
}

function buildTestingStrategySection(analysis) {
  return `## Testing Strategy

- Implementation verification rule: ${implementationVerificationRule}
- Unit tests: cover parsing logic, request validation, utility functions, and service-layer transformations.
- Controller/API tests: verify status codes, response shapes, and negative cases for all detected endpoints.
- Contract tests: compare legacy endpoint outputs against the new implementation for representative sample inputs, including auth-required routes, multipart uploads, request limits, and known error messages.
- Configuration tests: verify required environment variables, sensitive secret handling, and startup failure behavior without checking in real secrets.
- Persistence tests: verify each detected collection/model and filesystem artifact is read and written compatibly; verify debug/session data is not introduced unless source persistence exists.
- Visual regression tests: capture legacy screenshots before migration and compare target screenshots page by page to confirm the same layout, CSS, typography, colors, spacing, and responsive behavior.
- Integration tests: exercise remote fetch, PDF parsing, and HTML scraping flows with controlled fixtures and mocked network boundaries.
- Integration tests for external providers: mock detected AI/third-party clients, preserve provider fallback order, timeout behavior, model selection, and response parsing.
- Regression tests: capture edge cases from the current implementation, especially duplicate routes, shared state behavior, error paths, token/session behavior, and file cleanup.
- Smoke tests: validate startup, health checks, configuration loading, and one happy-path request after each deployment.
- Coverage priority: begin with the ${analysis.apiRoutes.length} detected routes and expand to supporting utilities and failure cases.`;
}

function buildPerformanceScalabilitySection() {
  return `## Performance and Scalability Plan

- Replace request-shared global state with request-scoped processing or persistent storage so concurrent requests do not overwrite each other.
- Add request timeouts, payload size limits, and backpressure around remote fetch and parsing operations.
- Cache only where correctness is preserved, and make cache behavior explicit rather than implicit in process memory.
- Profile the most expensive flows such as PDF parsing, HTML scraping, and large response generation.
- Prepare for horizontal scaling by keeping workers stateless and moving shared state into durable stores when required.
- Track latency percentiles, error rates, throughput, and memory growth under load before and after migration.`;
}

function buildDataModelMigrationSection(analysis) {
  return `## Data Model Migration

${inferPersistenceNotes(analysis)}
- Detected persistence and filesystem artifacts:
${formatPersistenceFindings(analysis)}
- Identify every input object, output object, transient processing structure, and stored artifact in the current implementation.
- Define DTOs or schema objects for request payloads, response payloads, extraction results, and error contracts.
- Document nullable fields, default values, enum-like fields, and backward-compatibility expectations.
- If database tables or collections are introduced in the target architecture, create migration scripts, seed assumptions, and rollback plans before cutover.
- For projects currently using in-memory or filesystem state only, explicitly decide whether to remain compatible with that storage model or introduce persistence as a separately approved change.
- Do not invent debug/session persistence. Treat debug assistants, chat flows, or report-generation steps as request/response behavior unless the source contains an explicit database table, collection, file, or queue for those artifacts.`;
}

function buildSequenceDiagramsSection(analysis) {
  const primaryRoute = analysis.apiRoutes[0];
  const primaryLabel = primaryRoute ? `${primaryRoute.method} ${primaryRoute.path}` : "Primary request";

  return `## Sequence and Flow Diagrams

### Primary Request Sequence

\`\`\`mermaid
sequenceDiagram
    participant Client
    participant API as Legacy/Target API
    participant Service as Processing Service
    participant External as Remote Source

    Client->>API: ${primaryLabel}
    API->>API: Validate request
    API->>Service: Execute extraction or business workflow
    Service->>External: Fetch remote content if needed
    External-->>Service: Return source payload
    Service->>Service: Parse, transform, and validate output
    Service-->>API: Return normalized result
    API-->>Client: Response payload or error contract
\`\`\`

### Migration Delivery Flow

\`\`\`mermaid
flowchart TD
    A[Analyze current project] --> B[Define target contracts]
    B --> C[Implement controllers and services]
    C --> D[Add validation and tests]
    D --> E[Run parity verification]
    E --> F[Deploy to staging]
    F --> G[Execute smoke and regression checks]
    G --> H[Production cutover]
\`\`\``;
}

function hasSection(markdown, title) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+${escapedTitle}\\s*$`, "im").test(markdown);
}

function appendMissingSection(markdown, title, sectionBuilder) {
  if (hasSection(markdown, title)) {
    return markdown;
  }

  return `${markdown.trim()}\n\n${sectionBuilder()}\n`;
}

function ensureExternalIntegrationsInImplementationPlan(markdown, analysis) {
  const integrationPlan = formatExternalIntegrationPlan(analysis);

  if (!integrationPlan || /^###\s+AI and Third-Party API Implementation Notes\s*$/im.test(markdown)) {
    return markdown;
  }

  const headingMatch = markdown.match(/^##\s+Deep Implementation Details\s*$/im);

  if (!headingMatch) {
    return markdown;
  }

  const startIndex = headingMatch.index + headingMatch[0].length;
  const nextSectionIndex = markdown.slice(startIndex).search(/\n##\s+/);

  if (nextSectionIndex === -1) {
    return `${markdown.trimEnd()}${integrationPlan}`;
  }

  const insertionIndex = startIndex + nextSectionIndex;

  return `${markdown.slice(0, insertionIndex).trimEnd()}${integrationPlan}\n${markdown.slice(insertionIndex)}`;
}

function buildConfigurationImplementationNotes(analysis) {
  return `\n\n### Environment Configuration and Limits\n\nUploaded-project environment variables and env-backed defaults must be preserved in the target deployment configuration.\n\nEnvironment variables used by source:\n${formatEnvironmentVariables(analysis)}\n\nUploaded .env entries:\n${formatEnvFileEntries(analysis)}\n\nToken, context, timeout, chunk, upload, body-size, and retrieval limits:\n${formatTokenAndSizeLimits(analysis)}\n\nSecret handling findings:\n${formatSecurityFindings(analysis)}\n`;
}

function ensureConfigurationInImplementationPlan(markdown, analysis) {
  if (/^###\s+Environment Configuration and Limits\s*$/im.test(markdown)) {
    return markdown;
  }

  const configurationNotes = buildConfigurationImplementationNotes(analysis);
  const headingMatch = markdown.match(/^##\s+Deep Implementation Details\s*$/im);

  if (!headingMatch) {
    return `${markdown.trimEnd()}${configurationNotes}`;
  }

  const startIndex = headingMatch.index + headingMatch[0].length;
  const nextSectionIndex = markdown.slice(startIndex).search(/\n##\s+/);

  if (nextSectionIndex === -1) {
    return `${markdown.trimEnd()}${configurationNotes}`;
  }

  const insertionIndex = startIndex + nextSectionIndex;

  return `${markdown.slice(0, insertionIndex).trimEnd()}${configurationNotes}\n${markdown.slice(insertionIndex)}`;
}

function removeGitInitializationSteps(markdown) {
  return markdown
    .replace(/^\s*(?:[-*+]\s*)?(?:\d+[.)]\s*)?(?:`{1,3})?\s*git\s+init\b.*$/gim, "")
    .replace(/```[a-zA-Z0-9_-]*\n\s*```/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function removeDependencyRegistryIntegrationNoise(markdown) {
  return markdown
    .split("\n")
    .filter(
      (line) =>
        !/^\s*[-*]\s+https?:\/\/(?:registry\.npmjs\.org|registry\.yarnpkg\.com|repo\.maven\.apache\.org|files\.pythonhosted\.org|rubygems\.org|crates\.io)\//i.test(
          line,
        ),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function ensureImplementationVerificationRule(markdown) {
  if (markdown.includes(implementationVerificationRule)) {
    return markdown;
  }

  const testingHeadingMatch = markdown.match(/^##\s+Testing Strategy\s*$/im);

  if (!testingHeadingMatch) {
    return `${markdown.trimEnd()}\n\n## Testing Strategy\n\n- Implementation verification rule: ${implementationVerificationRule}\n`;
  }

  const insertionIndex = testingHeadingMatch.index + testingHeadingMatch[0].length;

  return `${markdown.slice(0, insertionIndex)}\n\n- Implementation verification rule: ${implementationVerificationRule}${markdown.slice(insertionIndex)}`;
}

function formatTargetRouteMappings(analysis) {
  if (analysis.apiRoutes.length === 0) {
    return "- No Express-style routes were detected, so define target controllers from the required API contracts.";
  }

  return analysis.apiRoutes
    .map(
      (route) =>
        `- ${route.method} ${route.path}: migrate handler from ${route.filePath} into a target controller endpoint with service-layer business logic and DTO validation.`,
    )
    .join("\n");
}

function formatTargetDependencies(targetStack) {
  if (targetStack.toLowerCase().includes("spring")) {
    return `- Spring Boot Web for REST APIs
- Spring Boot Validation for request validation
- Spring Data JPA if database persistence is required
- Spring Security if authentication or authorization exists
- Maven or Gradle for backend dependency management
- React, Vite, and a typed API client for the frontend`;
  }

  return `- Keep frontend dependencies lean and aligned with the target UI framework
- Add backend framework dependencies required by ${targetStack}
- Add validation, testing, and environment configuration packages only where needed`;
}

export function buildFallbackMarkdown(analysis, targetStack = "React + Spring Boot", uiReference = null) {
  const primaryPackage = analysis.packageJsons[0];

  const markdown = `# Modernization Specification

## Target Stack

- Source project: ${analysis.projectName}
- Target stack: ${targetStack}
- Goal: upgrade language, runtime, framework, and dependency versions while preserving UI, API behavior, user workflows, and deployment simplicity.

## Project Overview

- Project name: ${analysis.projectName}
- Total files scanned: ${analysis.summary.fileCount}
- package.json files found: ${analysis.summary.packageJsonCount}
- React detected: ${analysis.stack.hasReact ? "Yes" : "No"}
- Node.js detected: ${analysis.stack.hasNode ? "Yes" : "No"}
- Express detected: ${analysis.stack.hasExpress ? "Yes" : "No"}

## Current Dependencies

### Dependencies

${formatDependencies(primaryPackage?.dependencies ?? {})}

### Dev Dependencies

${formatDependencies(primaryPackage?.devDependencies ?? {})}

## Express APIs

${formatRoutes(analysis)}

${buildParityContractSection()}

${buildUiReferenceSection(uiReference)}

${buildUiPreservationPlanSection()}

## Target API Mapping

${formatTargetRouteMappings(analysis)}

## Target Dependencies

${formatTargetDependencies(targetStack)}

## Target Folder Structure

\`\`\`text
frontend/
  src/
    components/
    pages/
    services/
    styles/
backend/
  src/main/java/com/example/app/
    controller/
    service/
    repository/
    dto/
    config/
  src/main/resources/
    application.yml
\`\`\`

## Recommended Migration Goals

- Upgrade runtime and framework dependencies to actively supported versions.
- Keep the React frontend visually and behaviorally identical; update packages/build tooling only as required by the selected target versions.
- Replace Express route handlers with Spring Boot controllers when Spring Boot is the target backend.
- Move business logic into backend services instead of controller methods.
- Add DTOs and validation for request and response contracts.
- Standardize build, lint, test, and environment configuration for both apps.

## Suggested Delivery Phases

### Phase 1

- Confirm current API behavior, page flows, and package usage.
- Create the target stack project skeleton.
- Define shared API contracts and environment configuration.
- Capture screenshots or UI snapshots for parity comparison before code migration.

### Phase 2

- Rebuild detected APIs in the target backend framework.
- Move reusable backend logic into services.
- Keep the existing frontend UI unchanged while connecting it to compatible backend endpoints.

### Phase 3

- Add validation, error handling, and integration tests.
- Document local setup, deployment steps, and migration risks.
- Run side-by-side UI, workflow, and API parity validation before switching traffic.
`;

  return ensureSpecCompleteness(markdown, analysis, targetStack, uiReference);
}

export function formatRagContextForPrompt(chunks) {
  if (!chunks?.length) {
    return "No retrieved file context available.";
  }

  return chunks
    .map(
      (chunk, index) =>
        `### Context ${index + 1}\nFile: ${chunk.file_path}\nChunk: ${chunk.chunk_index}\n\n${chunk.content}`,
    )
    .join("\n\n");
}

export function ensureSpecCompleteness(
  markdown,
  analysis,
  targetStack = "React + Spring Boot",
  uiReference = null,
) {
  let enrichedMarkdown = markdown?.trim() || "# Modernization Specification";

  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "Deep Implementation Details", () =>
    buildImplementationDetailsSection(analysis, targetStack),
  );
  enrichedMarkdown = ensureExternalIntegrationsInImplementationPlan(enrichedMarkdown, analysis);
  enrichedMarkdown = ensureConfigurationInImplementationPlan(enrichedMarkdown, analysis);
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "UI and Functionality Parity Contract", () =>
    buildParityContractSection(),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "UI Reference Extracted from Original Code", () =>
    buildUiReferenceSection(uiReference),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "UI Preservation Implementation Plan", () =>
    buildUiPreservationPlanSection(),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "Non-Functional Requirements", () =>
    buildNonFunctionalRequirementsSection(analysis),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "Architecture Decisions", () =>
    buildArchitectureDecisionsSection(analysis, targetStack),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "Validation Rules", () =>
    buildValidationRulesSection(analysis),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "Deployment Details", () =>
    buildDeploymentDetailsSection(targetStack),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "Testing Strategy", () =>
    buildTestingStrategySection(analysis),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "Performance and Scalability Plan", () =>
    buildPerformanceScalabilitySection(),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "Data Model Migration", () =>
    buildDataModelMigrationSection(analysis),
  );
  enrichedMarkdown = appendMissingSection(enrichedMarkdown, "Sequence and Flow Diagrams", () =>
    buildSequenceDiagramsSection(analysis),
  );

  return ensureImplementationVerificationRule(
    removeDependencyRegistryIntegrationNoise(removeGitInitializationSteps(enrichedMarkdown)),
  ).trimEnd();
}
