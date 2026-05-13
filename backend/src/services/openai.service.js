import OpenAI from "openai";
import "../config/load-env.js";
import { buildFallbackMarkdown, ensureSpecCompleteness } from "./spec-markdown.service.js";

let client = null;

function hasUsableOpenAiKey() {
  const openAiApiKey = process.env.OPENAI_API_KEY;

  return Boolean(
    openAiApiKey &&
      openAiApiKey.trim() &&
      !["your_key_here", "your-openai-api-key"].includes(openAiApiKey.trim().toLowerCase()),
  );
}

function getClient() {
  if (!hasUsableOpenAiKey()) {
    return null;
  }

  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return client;
}

function estimateTokenCount(text) {
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

function buildSummaryContext(analysis) {
  const packages =
    analysis.packageJsons
      .map((pkg) => {
        const dependencies = Object.keys(pkg.dependencies ?? {}).join(", ") || "None";
        const devDependencies = Object.keys(pkg.devDependencies ?? {}).join(", ") || "None";
        const scripts = pkg.scripts.join(", ") || "None";

        return `Package: ${pkg.name ?? "unknown"}
Version: ${pkg.version ?? "unknown"}
Scripts: ${scripts}
Dependencies: ${dependencies}
Dev dependencies: ${devDependencies}`;
      })
      .join("\n\n") || "No package.json files found";

  const routes =
    analysis.apiRoutes
      .map((route) => `${route.method} ${route.path} (${route.filePath}${route.framework ? `, ${route.framework}` : ""})`)
      .join("\n") || "No Express or Spring routes detected";

  const javaBuildFiles =
    analysis.javaBuildFiles
      ?.map((buildFile) => {
        const dependencies = buildFile.dependencies?.join(", ") || "None";

        return `Java build file: ${buildFile.path}
Tool: ${buildFile.tool}
Dependencies/artifacts: ${dependencies}`;
      })
      .join("\n\n") || "No Java build files found";

  const externalIntegrations =
    analysis.externalIntegrations
      ?.map((integration) => {
        const location = integration.line
          ? `${integration.filePath}:${integration.line}`
          : integration.filePath || "dependency manifest";
        const dependency = integration.dependency ? ` via ${integration.dependency}` : "";
        const provider = integration.provider ? ` provider=${integration.provider}` : "";

        return `- ${integration.name}${dependency}${provider} (${integration.category}, ${location})`;
      })
      .join("\n") || "No AI or third-party API integrations detected";

  const environmentVariables =
    analysis.configuration?.environmentVariables
      ?.map(
        (item) =>
          `- ${item.name}${item.sensitive ? " (sensitive)" : ""} (${item.filePath}:${item.line})`,
      )
      .join("\n") || "No environment variables detected";

  const envFileDetails =
    analysis.configuration?.envFileEntries
      ?.map(
        (item) =>
          `- ${item.name}=${item.value || "(empty)"}${item.sensitive ? " (sensitive, value redacted if real)" : ""}${item.limitLike ? " (limit/size/token setting)" : ""} (${item.filePath}:${item.line})`,
      )
      .join("\n") || "No .env file entries detected";

  const tokenAndSizeLimits =
    analysis.configuration?.tokenAndSizeLimits
      ?.map(
        (item) =>
          `- ${item.name}=${item.value || "(empty)"} (${item.source}, ${item.filePath}:${item.line})`,
      )
      .join("\n") || "No token, context, timeout, chunk, upload, or size limits detected from environment/defaults";

  const securityFindings =
    analysis.configuration?.securityFindings
      ?.map((item) => `- ${item.type}: ${item.variableName} (${item.filePath}:${item.line})`)
      .join("\n") || "No hardcoded sensitive fallback values detected";

  const persistenceFindings = [
    ...(analysis.persistence?.collections ?? []).map(
      (item) => `- ${item.kind}: ${item.name} (${item.filePath}:${item.line})`,
    ),
    ...(analysis.persistence?.storageArtifacts ?? []).map(
      (item) => `- filesystem artifact: ${item.name} (${item.filePath}:${item.line})`,
    ),
  ].join("\n") || "No explicit persistence collections or filesystem artifacts detected";

  const requestLimits = [
    ...(analysis.requestLimits?.bodyLimits ?? []).map(
      (item) => `- JSON/body limit: ${item.value} (${item.filePath}:${item.line})`,
    ),
    ...(analysis.requestLimits?.uploadFields ?? []).map(
      (item) => `- multipart upload field: ${item.fieldName} (${item.filePath}:${item.line})`,
    ),
    ...(analysis.requestLimits?.uploadLimits ?? []).map(
      (item) => `- upload/file size expression: ${item.expression} (${item.filePath}:${item.line})`,
    ),
  ].join("\n") || "No explicit request limits detected";

  const authFindings = [
    ...(analysis.auth?.hints ?? []).map((item) => `- ${item.name}: ${item.detail} (${item.filePath})`),
    ...(analysis.auth?.localStorageKeys ?? []).map(
      (item) => `- localStorage token key: ${item.key} (${item.filePath}:${item.line})`,
    ),
  ].join("\n") || "No auth implementation hints detected";

  const apiContractHints =
    analysis.apiContractHints
      ?.map((item) => {
        const body = item.bodyFields?.length ? ` body=${item.bodyFields.join(",")}` : "";
        const params = item.pathParams?.length ? ` params=${item.pathParams.join(",")}` : "";
        const query = item.queryParams?.length ? ` query=${item.queryParams.join(",")}` : "";
        const statuses = item.statusCodes?.length ? ` statuses=${item.statusCodes.join(",")}` : "";
        const responses = item.responseKeys?.length ? ` responseKeys=${item.responseKeys.join(",")}` : "";

        return `- ${item.filePath}:${body}${params}${query}${statuses}${responses}`.trim();
      })
      .join("\n") || "No source-level request/response hints detected";

  return `Project: ${analysis.projectName}
Files scanned: ${analysis.summary.fileCount}
package.json files found: ${analysis.summary.packageJsonCount}
Java files found: ${analysis.summary.javaFileCount ?? 0}
Java build files found: ${analysis.summary.javaBuildFileCount ?? 0}
React detected: ${analysis.stack.hasReact ? "Yes" : "No"}
Node.js detected: ${analysis.stack.hasNode ? "Yes" : "No"}
Express detected: ${analysis.stack.hasExpress ? "Yes" : "No"}
Java detected: ${analysis.stack.hasJava ? "Yes" : "No"}
Spring Boot detected: ${analysis.stack.hasSpringBoot ? "Yes" : "No"}

Dependencies and scripts:
${packages}

Java build context:
${javaBuildFiles}

Detected AI and third-party API integrations:
${externalIntegrations}

Configuration and security findings:
Environment variables:
${environmentVariables}

Uploaded project .env entries:
${envFileDetails}

Token, context, timeout, chunk, upload, and size limits:
${tokenAndSizeLimits}

Security findings:
${securityFindings}

Persistence and storage findings:
${persistenceFindings}

Request limits, multipart fields, and body parser settings:
${requestLimits}

Authentication/session hints:
${authFindings}

Source-level API contract hints:
${apiContractHints}

Extracted APIs:
${routes}`;
}

function buildRetrievedContext(retrievedChunks) {
  if (!retrievedChunks?.length) {
    return "No additional retrieved file context was available.";
  }

  return retrievedChunks
    .map(
      (chunk, index) =>
        `Context ${index + 1}
File: ${chunk.path}
Chunk: ${chunk.chunkIndex}

${chunk.content}`,
    )
    .join("\n\n");
}

const legacyUiExtensions = new Set([
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".styl",
  ".tsx",
  ".jsx",
  ".vue",
  ".svelte",
  ".astro",
  ".jsp",
  ".ejs",
  ".hbs",
  ".handlebars",
  ".pug",
  ".ftl",
  ".vm",
  ".cshtml",
]);

function isLegacyUiSourcePath(filePath) {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  const extension = normalized.slice(normalized.lastIndexOf("."));

  return (
    legacyUiExtensions.has(extension) ||
    normalized.includes("/components/") ||
    normalized.includes("/pages/") ||
    normalized.includes("/views/") ||
    normalized.includes("/templates/") ||
    normalized.includes("/styles/") ||
    normalized.includes("/css/")
  );
}

function buildLegacyUiContext(retrievedChunks) {
  const uiChunks = retrievedChunks?.filter((chunk) => isLegacyUiSourcePath(chunk.path)) ?? [];

  if (!uiChunks.length) {
    return "No dedicated legacy UI, template, or stylesheet context was retrieved. The spec must still require an explicit UI/CSS inventory before implementation.";
  }

  return uiChunks
    .map(
      (chunk, index) =>
        `Legacy UI source ${index + 1}
File: ${chunk.path}
Chunk: ${chunk.chunkIndex}

${chunk.content}`,
    )
    .join("\n\n");
}

function buildPrompt(analysis, retrievedChunks = [], targetStack = "React + Spring Boot", uiReference = null) {
  const uiReferenceMarkdown =
    uiReference?.markdown ??
    "## UI Reference Extracted from Original Code\n\n- No extracted UI reference was provided. The spec must require an original-code UI inventory before frontend implementation.";

  return `
You are generating a modernization specification for an engineering team.

Create a practical markdown document named modernization-spec.md.

Source project:
- Use the detected project as the source system.
- Preserve the current business capabilities, pages, API behavior, data contracts, and dependencies where possible.

Target modernization stack:
- ${targetStack}

Modernization boundary:
- Separate UI from functionality. Generated specification content should focus on logic, APIs, flows, validation, behavior, dependency upgrades, and implementation sequencing.
- This is a language, framework, runtime, and dependency version upgrade specification, not a redesign or product rewrite.
- Do not invent UI from scratch. Do not propose new visual design, new screens, new layouts, new components, new colors, new spacing, new typography, new icons, alternate copy, or changed navigation.
- Use only the "UI Reference Extracted from Original Code" section below for UI details. If a UI detail is missing from that section, say it must be confirmed from original source before implementation instead of inventing it.
- Preserve the existing UI exactly: layout, styling, CSS classes, visible text, page structure, navigation, forms, controls, and user interactions must stay the same unless a target-version compatibility issue makes a tiny mechanical change unavoidable.
- Treat extracted legacy UI files, templates, stylesheets, and component files as the visual source of truth. The target frontend must copy or directly translate those files one-to-one instead of creating a new design.
- Reuse existing CSS selectors, class names, design tokens, asset paths, icons, image references, spacing, colors, typography, and responsive behavior from the extracted UI reference. New CSS is allowed only for framework compatibility glue.
- Preserve visible UI text exactly, including headings, labels, button/link copy, placeholders, aria labels, alt/title text, empty states, loading text, validation messages, and error copy. Do not rewrite or improve copy.
- Preserve CSS and styling files exactly where possible. If target tooling requires translation, map every source stylesheet, selector, CSS variable, media query, utility class, color, typography rule, spacing rule, and asset reference to the target equivalent.
- Preserve functionality exactly: API endpoints, request and response shapes, status codes, validation behavior, side effects, error messages, and user workflows must remain compatible with the source system.
- Do not propose new UI screens, new features, visual redesigns, alternate workflows, changed copy, new data fields, or behavior improvements as part of this modernization.
- When frontend source exists, specify version/package/build-tool upgrades and compatibility edits only. Treat component rewrites as out of scope unless the target framework/language requires a direct one-to-one translation.
- If backend language or framework changes, rewrite internals only as needed while keeping the external API contract and frontend integration behavior unchanged.

Requirements:
- Keep recommendations simple and MVP-friendly
- No microservices
- No Redis or BullMQ
- Generate a build-ready migration specification for the target stack without changing UI or product behavior
- If the source backend is Express/Node.js and the target backend is Spring Boot, map Express routes to Spring controllers/services/repositories
- If detected AI providers, third-party API clients, API-key variables, model names, or real external service URLs exist, include them inside the existing "Deep Implementation Details" section as implementation notes. Do not create a separate top-level AI/RAG section.
- Do not treat dependency lockfiles, package manager registry URLs, package tarball URLs, funding URLs, or repository/homepage URLs as product integrations.
- Do not include actual secret values in the spec. If a sensitive fallback or committed-looking secret is detected, name the variable and file location only, and require rotation plus environment-only configuration.
- Include uploaded-project environment variables and .env settings in Deployment Details, Deep Implementation Details, and validation notes. Redact sensitive values, but keep non-secret values such as ports, model names, token limits, context windows, chunk sizes, timeouts, top-k values, and upload/body size limits.
- For every detected route, include method/path, mounted/full path when discoverable, auth or middleware requirements when visible, request inputs, response top-level keys, known status codes, known error messages, and unknowns that need source confirmation.
- In data migration sections, clearly separate database tables/collections from filesystem artifacts and runtime/transient request state. Do not invent debug/session persistence if only request/response behavior is visible.
- Carry forward request size limits, multipart field names, upload limits, token/session behavior, frontend API base URL variables, and local storage keys when visible in the source.
- Include this implementation verification rule in the Testing Strategy or final engineering notes: "Run the code and if it is not working then fix it without changing any functionality of it; test the API also."
- Include frontend version/compatibility notes, backend migration notes, API contract mapping, dependency mapping, target folder structure, risks, parity checks, and implementation phases
- Include deep implementation details, non-functional requirements, architecture decisions, validation rules, deployment details, testing strategy, performance and scalability planning, data model migration depth, and sequence/flow diagrams
- Use \`##\` headings for every major section so the document can be split into a multi-file spec pack
- Be specific to the detected project; avoid generic filler and call out assumptions explicitly when information is missing
- Keep the architecture clean and modular, but do not introduce advanced distributed architecture
- Do not include \`git init\`, Git repository initialization, or source-control bootstrapping commands. Assume the project already exists in source control.

Mandatory sections:
- Current State Summary
- Detected Stack
- UI and Functionality Parity Contract
- UI Reference Extracted from Original Code
- UI Preservation Implementation Plan
- Current Dependencies
- Express APIs or API Inventory
- Target API Mapping
- Deep Implementation Details
- Non-Functional Requirements
- Architecture Decisions
- Validation Rules
- Deployment Details
- Testing Strategy
- Performance and Scalability Plan
- Data Model Migration
- Sequence and Flow Diagrams
- Recommended Migration Goals
- Suggested Delivery Phases

Summary context:
${buildSummaryContext(analysis)}

Extracted UI reference:
${uiReferenceMarkdown}

Retrieved file context:
${buildRetrievedContext(retrievedChunks)}

Legacy UI/CSS source-of-truth context:
${buildLegacyUiContext(retrievedChunks)}

Structured project analysis:
${JSON.stringify(analysis, null, 2)}
`;
}

export async function generateModernizationSpec(
  analysis,
  retrievedChunks = [],
  targetStack = "React + Spring Boot",
  uiReference = null,
) {
  const openAiClient = getClient();
  const prompt = buildPrompt(analysis, retrievedChunks, targetStack, uiReference);
  const promptTokenEstimate = estimateTokenCount(prompt);

  if (!openAiClient) {
    const markdown = buildFallbackMarkdown(analysis, targetStack, uiReference);

    return {
      markdown,
      telemetry: {
        provider: "fallback",
        promptTokenEstimate,
        inputTokens: 0,
        outputTokens: estimateTokenCount(markdown),
        totalTokens: promptTokenEstimate + estimateTokenCount(markdown),
      },
    };
  }

  try {
    const response = await openAiClient.responses.create({
      model: process.env.OPENAI_MODEL,
      input: prompt,
    });

    const markdown = ensureSpecCompleteness(
      response.output_text || buildFallbackMarkdown(analysis, targetStack, uiReference),
      analysis,
      targetStack,
      uiReference,
    );
    const usage = response.usage ?? {};
    const inputTokens = usage.input_tokens ?? promptTokenEstimate;
    const outputTokens = usage.output_tokens ?? estimateTokenCount(markdown);
    const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;

    return {
      markdown,
      telemetry: {
        provider: "openai",
        model: process.env.OPENAI_MODEL,
        promptTokenEstimate,
        inputTokens,
        outputTokens,
        totalTokens,
      },
    };
  } catch (error) {
    console.warn(`OpenAI generation unavailable; using fallback spec generation. ${error.message}`);
    const markdown = buildFallbackMarkdown(analysis, targetStack, uiReference);
    const outputTokens = estimateTokenCount(markdown);

    return {
      markdown,
      telemetry: {
        provider: "fallback",
        model: process.env.OPENAI_MODEL,
        promptTokenEstimate,
        inputTokens: 0,
        outputTokens,
        totalTokens: promptTokenEstimate + outputTokens,
      },
    };
  }
}
