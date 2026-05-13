import fs from "node:fs";
import path from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";
import { numberEnv } from "../config/load-env.js";
import { safeReadTextFile, walkFiles } from "../utils/file-system.js";

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const javaSourceExtensions = new Set([".java"]);
const routeMethods = new Set(["get", "post", "put", "patch", "delete"]);
const dependencyLockFiles = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "composer.lock",
  "poetry.lock",
  "pipfile.lock",
  "cargo.lock",
  "gemfile.lock",
  "go.sum",
]);
const dependencyManifestFiles = new Set([
  "package.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "requirements.txt",
  "pyproject.toml",
  "composer.json",
  "gemfile",
  "cargo.toml",
  "go.mod",
]);
const envFileNames = new Set([".env", ".env.local", ".env.development", ".env.production", ".env.test"]);
const nonStorageArtifactNames = new Set([
  ...dependencyLockFiles,
  ...dependencyManifestFiles,
  "tsconfig.json",
  "jsconfig.json",
  "vite.config.js",
  "vite.config.ts",
  "tailwind.config.js",
  "postcss.config.js",
  "eslint.config.js",
]);
const ragExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".java",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".xml",
  ".gradle",
  ".properties",
  ".env",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".styl",
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

const springMappingAnnotations = new Map([
  ["GetMapping", "GET"],
  ["PostMapping", "POST"],
  ["PutMapping", "PUT"],
  ["PatchMapping", "PATCH"],
  ["DeleteMapping", "DELETE"],
]);

const knownIntegrationDependencies = new Map([
  ["openai", { category: "ai", service: "OpenAI" }],
  ["@anthropic-ai/sdk", { category: "ai", service: "Anthropic" }],
  ["@google/generative-ai", { category: "ai", service: "Google Gemini" }],
  ["langchain", { category: "ai", service: "LangChain" }],
  ["@langchain/openai", { category: "ai", service: "LangChain OpenAI" }],
  ["llamaindex", { category: "ai", service: "LlamaIndex" }],
  ["stripe", { category: "payment", service: "Stripe" }],
  ["twilio", { category: "messaging", service: "Twilio" }],
  ["@sendgrid/mail", { category: "email", service: "SendGrid" }],
  ["mailgun.js", { category: "email", service: "Mailgun" }],
  ["firebase", { category: "platform", service: "Firebase" }],
  ["@supabase/supabase-js", { category: "platform", service: "Supabase" }],
  ["aws-sdk", { category: "cloud", service: "AWS SDK" }],
]);
const knownJavaIntegrationArtifacts = new Map([
  ["spring-ai-openai", { category: "ai", service: "Spring AI OpenAI" }],
  ["openai-java", { category: "ai", service: "OpenAI Java" }],
  ["langchain4j", { category: "ai", service: "LangChain4j" }],
  ["stripe-java", { category: "payment", service: "Stripe" }],
  ["twilio", { category: "messaging", service: "Twilio" }],
  ["firebase-admin", { category: "platform", service: "Firebase" }],
  ["aws-java-sdk", { category: "cloud", service: "AWS SDK" }],
  ["software.amazon.awssdk", { category: "cloud", service: "AWS SDK v2" }],
]);
const externalUrlPattern = /https?:\/\/[^\s"'`<>),}]+/gi;
const credentialVariablePattern =
  /\b([A-Z][A-Z0-9_]*(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|CLIENT_SECRET|WEBHOOK_SECRET|SECRET_KEY|PRIVATE_KEY|BEARER_TOKEN|PASSWORD|OPENAI_MODEL|AI_MODEL|LLM_MODEL|EMBEDDING_MODEL))\b/g;
const aiModelNamePattern =
  /\b(?:gpt-[a-z0-9._-]+|o[0-9](?:-[a-z0-9._-]+)?|text-embedding-[a-z0-9._-]+|claude-[a-z0-9._-]+|gemini-[a-z0-9._-]+|llama(?:[-_:]?\d[a-z0-9._:-]*|-[a-z0-9._:-]+)?|mistral-[a-z0-9._-]+|mixtral-[a-z0-9._-]+)\b/gi;
const envVariablePattern =
  /\b(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)\b|\b(?:process\.env|import\.meta\.env)\[['"]([A-Z][A-Z0-9_]*)['"]\]/g;
const envFallbackPattern =
  /\b(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*(?:Number\()?(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)\)?\s*(?:\|\||\?\?)\s*["']([^"']*)["']/g;
const envAnyFallbackPattern =
  /\b(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*(?:Number\()?(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)(?:\))?\s*(?:\|\||\?\?)\s*([^;\n]+)/g;
const collectionNamePattern = /\b(?:db|database|client)\.collection\s*\(\s*["']([^"']+)["']\s*\)/g;
const mongooseModelPattern = /\bmongoose\.model\s*\(\s*["']([^"']+)["']/g;
const storageArtifactPattern = /["']([^"']+\.(?:json|db|sqlite|sqlite3|csv|txt|zip|log))["']/gi;
const bodyLimitPattern = /\b(?:express|bodyParser)\.json\s*\(\s*\{[^}]*\blimit\s*:\s*["']([^"']+)["']/g;
const uploadFieldPattern = /\b(?:upload|multerUpload)\.single\s*\(\s*["']([^"']+)["']\s*\)/g;
const uploadFileSizePattern = /\bfileSize\s*:\s*([^,\n}]+)/g;
const requestBodyFieldPattern = /\breq\.body(?:\?\.|\.)?([A-Za-z_$][\w$]*)/g;
const requestParamFieldPattern = /\breq\.params(?:\?\.|\.)?([A-Za-z_$][\w$]*)/g;
const requestQueryFieldPattern = /\breq\.query(?:\?\.|\.)?([A-Za-z_$][\w$]*)/g;
const responseStatusPattern = /\bres\.status\s*\(\s*(\d{3})\s*\)/g;
const responseObjectPattern = /\bres(?:\.status\s*\(\s*\d{3}\s*\))?\.json\s*\(\s*\{([^)]{0,260})\}\s*\)/g;
const localStorageKeyPattern = /\bconst\s+([A-Z][A-Z0-9_]*TOKEN[A-Z0-9_]*)\s*=\s*["']([^"']+)["']/g;

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function parsePackageJson(packageJsonPath) {
  const content = safeReadJson(packageJsonPath);

  if (!content) {
    return null;
  }

  return {
    name: typeof content.name === "string" ? content.name : undefined,
    version: typeof content.version === "string" ? content.version : undefined,
    scripts: Object.keys(content.scripts ?? {}),
    dependencies: content.dependencies ?? {},
    devDependencies: content.devDependencies ?? {},
    engines: content.engines ?? {},
  };
}

function getRelativePath(rootPath, filePath) {
  return path.relative(rootPath, filePath);
}

function getBaseName(filePath) {
  return path.basename(filePath).toLowerCase();
}

function isDependencyLockFile(filePath) {
  return dependencyLockFiles.has(getBaseName(filePath));
}

function isDependencyManifestFile(filePath) {
  return dependencyManifestFiles.has(getBaseName(filePath));
}

function isSensitiveConfigName(name) {
  return /(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|CLIENT_SECRET|WEBHOOK_SECRET|SECRET_KEY|PRIVATE_KEY|BEARER_TOKEN|PASSWORD|SECRET|TOKEN|DATABASE_URL)$/i.test(
    name,
  );
}

function isTokenOrSizeLimitName(name) {
  if (isSensitiveConfigName(name)) {
    return false;
  }

  return /(?:NUM_CTX|NUM_PREDICT|MAX_TOKENS|TOKEN_LIMIT|MAX_|LIMIT|SIZE|TIMEOUT|TIMEOUT_MS|CHUNK|TOP_K|CONTEXT|WINDOW)/i.test(
    name,
  );
}

function isPlaceholderSecret(value) {
  return /^(?:|your[_-]?.*|change[_-]?me.*|todo|placeholder|example|test|dev|local|none|null)$/i.test(
    String(value ?? "").trim(),
  );
}

function hasEmbeddedCredential(value) {
  try {
    const url = new URL(String(value ?? ""));
    return Boolean(url.username || url.password);
  } catch {
    return false;
  }
}

function isSensitiveConfigValue(name, value) {
  return isSensitiveConfigName(name) || hasEmbeddedCredential(value);
}

function sanitizeConfigValue(name, value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .replace(/[),;]+$/, "");

  if (!normalizedValue) {
    return "";
  }

  if (isSensitiveConfigValue(name, normalizedValue) && !isPlaceholderSecret(normalizedValue)) {
    return "[redacted]";
  }

  return normalizedValue.replace(/^["']|["']$/g, "");
}

function parseEnvFile(content) {
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return null;
      }

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

      if (!match) {
        return null;
      }

      return {
        name: match[1],
        value: match[2].trim().replace(/^["']|["']$/g, ""),
        line: index + 1,
      };
    })
    .filter(Boolean);
}

function sanitizeEnvContent(content) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return line;
      }

      const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);

      if (!match) {
        return line;
      }

      const [, prefix, name, separator, rawValue] = match;
      return `${prefix}${name}${separator}${sanitizeConfigValue(name, rawValue)}`;
    })
    .join("\n");
}

function addUnique(items, seen, key, item) {
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  items.push(item);
}

function uniqueValues(values, limit = 24) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

function parseJavaBuildFile(buildFilePath, rootPath) {
  const content = safeReadTextFile(buildFilePath);

  if (!content) {
    return null;
  }

  const normalizedPath = path.relative(rootPath, buildFilePath);
  const dependencies = [];

  const dependencyPatterns = [
    /<artifactId>([^<]+)<\/artifactId>/g,
    /implementation\s*\(?\s*["']([^"']+)["']/g,
    /api\s*\(?\s*["']([^"']+)["']/g,
    /runtimeOnly\s*\(?\s*["']([^"']+)["']/g,
    /testImplementation\s*\(?\s*["']([^"']+)["']/g,
  ];

  for (const pattern of dependencyPatterns) {
    for (const match of content.matchAll(pattern)) {
      dependencies.push(match[1]);
    }
  }

  return {
    path: normalizedPath,
    tool: path.basename(buildFilePath),
    dependencies: Array.from(new Set(dependencies)).sort((a, b) => a.localeCompare(b)),
  };
}

function extractRoutesFromSourceFile(filePath, rootPath) {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
  });

  const sourceFile = project.addSourceFileAtPath(filePath);
  const routes = [];

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) {
      return;
    }

    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      return;
    }

    const method = expression.getName().toLowerCase();
    if (!routeMethods.has(method)) {
      return;
    }

    const args = node.getArguments();
    const firstArg = args[0];

    if (!firstArg || firstArg.getKind() !== SyntaxKind.StringLiteral) {
      return;
    }

    routes.push({
      method: method.toUpperCase(),
      path: firstArg.getText().slice(1, -1),
      filePath: getRelativePath(rootPath, filePath),
    });
  });

  return routes;
}

function normalizeRoutePath(...parts) {
  const joined = parts
    .filter((part) => typeof part === "string" && part.length > 0)
    .join("/");
  const normalized = `/${joined}`
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");

  return normalized || "/";
}

function parseAnnotationPath(args = "") {
  const pathMatch =
    args.match(/(?:value|path)\s*=\s*\{\s*"([^"]+)"/) ??
    args.match(/(?:value|path)\s*=\s*"([^"]+)"/) ??
    args.match(/"([^"]+)"/);

  return pathMatch?.[1] ?? "";
}

function extractSpringRoutesFromJavaFile(filePath, rootPath) {
  const content = safeReadTextFile(filePath);

  if (!content) {
    return [];
  }

  const classIndex = content.search(/\bclass\s+\w+/);
  const classPreamble = classIndex >= 0 ? content.slice(0, classIndex) : "";
  const classRequestMapping = Array.from(
    classPreamble.matchAll(/@RequestMapping\s*(?:\(([^)]*)\))?/g),
  ).at(-1);
  const basePath = parseAnnotationPath(classRequestMapping?.[1] ?? "");
  const routes = [];
  const mappingPattern =
    /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\s*(?:\(([^)]*)\))?/g;

  for (const match of content.matchAll(mappingPattern)) {
    const [raw, annotation, args = ""] = match;

    if (annotation === "RequestMapping" && match.index < classIndex) {
      continue;
    }

    const requestMethodMatch = args.match(/RequestMethod\.(GET|POST|PUT|PATCH|DELETE)/);
    const method = springMappingAnnotations.get(annotation) ?? requestMethodMatch?.[1];

    if (!method) {
      continue;
    }

    routes.push({
      method,
      path: normalizeRoutePath(basePath, parseAnnotationPath(args)),
      filePath: getRelativePath(rootPath, filePath),
      framework: "spring",
      source: raw.trim(),
    });
  }

  return routes;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function inferAiProvider(modelName) {
  const normalized = modelName.toLowerCase();

  if (normalized.startsWith("gpt-") || normalized.startsWith("o") || normalized.startsWith("text-embedding-")) {
    return "OpenAI";
  }

  if (normalized.startsWith("claude-")) {
    return "Anthropic";
  }

  if (normalized.startsWith("gemini-")) {
    return "Google Gemini";
  }

  if (normalized.startsWith("llama")) {
    return "Meta/Llama";
  }

  if (normalized.startsWith("mistral-") || normalized.startsWith("mixtral-")) {
    return "Mistral";
  }

  return "AI model";
}

function sanitizeUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/)[0];
  }
}

function isPlaceholderExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === "github.com" && url.pathname.toLowerCase() === "/owner/repo";
  } catch {
    return false;
  }
}

function isExternalUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

function addExternalIntegration(integrations, seen, integration) {
  const key =
    integration.type === "credential" || integration.type === "ai-model"
      ? `${integration.type}:${integration.name}:${integration.filePath ?? ""}`
      : `${integration.type}:${integration.name}:${integration.filePath ?? ""}:${integration.line ?? ""}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  integrations.push(integration);
}

function extractExternalIntegrationsFromFile(filePath, rootPath, integrations, seen) {
  const content = safeReadTextFile(filePath);

  if (!content) {
    return;
  }

  const relativePath = getRelativePath(rootPath, filePath);
  const shouldScanUrls = !isDependencyLockFile(filePath) && !isDependencyManifestFile(filePath);

  if (shouldScanUrls) {
    for (const match of content.matchAll(externalUrlPattern)) {
      if (!isExternalUrl(match[0]) || isPlaceholderExternalUrl(match[0])) {
        continue;
      }

      addExternalIntegration(integrations, seen, {
        type: "external-url",
        category: "third-party-api",
        name: sanitizeUrl(match[0]),
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
      });
    }
  }

  for (const match of content.matchAll(credentialVariablePattern)) {
    addExternalIntegration(integrations, seen, {
      type: "credential",
      category: "configuration",
      name: match[1],
      filePath: relativePath,
      line: getLineNumber(content, match.index ?? 0),
    });
  }

  for (const match of content.matchAll(aiModelNamePattern)) {
    addExternalIntegration(integrations, seen, {
      type: "ai-model",
      category: "ai",
      name: match[0],
      provider: inferAiProvider(match[0]),
      filePath: relativePath,
      line: getLineNumber(content, match.index ?? 0),
    });
  }
}

function extractExternalIntegrations(allFiles, projectRootPath, packageJsons, javaBuildFiles) {
  const integrations = [];
  const seen = new Set();

  for (const pkg of packageJsons) {
    const dependencyEntries = Object.entries({
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    });

    for (const [dependencyName, version] of dependencyEntries) {
      const integration = knownIntegrationDependencies.get(dependencyName);

      if (integration) {
        addExternalIntegration(integrations, seen, {
          type: "dependency",
          category: integration.category,
          name: integration.service,
          dependency: dependencyName,
          version,
        });
      }
    }
  }

  for (const buildFile of javaBuildFiles) {
    for (const dependency of buildFile.dependencies ?? []) {
      const normalizedDependency = dependency.toLowerCase();
      const match = Array.from(knownJavaIntegrationArtifacts.entries()).find(([artifact]) =>
        normalizedDependency.includes(artifact),
      );

      if (match) {
        addExternalIntegration(integrations, seen, {
          type: "dependency",
          category: match[1].category,
          name: match[1].service,
          dependency,
          filePath: buildFile.path,
        });
      }
    }
  }

  allFiles
    .filter(isLikelyUsefulForRag)
    .filter((filePath) => !isDependencyLockFile(filePath))
    .forEach((filePath) => extractExternalIntegrationsFromFile(filePath, projectRootPath, integrations, seen));

  return integrations.slice(0, 40);
}

function extractConfigurationFindings(allFiles, projectRootPath) {
  const environmentVariables = [];
  const envFileEntries = [];
  const tokenAndSizeLimits = [];
  const securityFindings = [];
  const seenEnv = new Set();
  const seenEnvFile = new Set();
  const seenLimits = new Set();
  const seenSecurity = new Set();

  for (const filePath of allFiles.filter(isLikelyUsefulForRag).filter((item) => !isDependencyLockFile(item))) {
    const content = safeReadTextFile(filePath);

    if (!content) {
      continue;
    }

    const relativePath = getRelativePath(projectRootPath, filePath);

    if (envFileNames.has(getBaseName(filePath)) || getBaseName(filePath).startsWith(".env.")) {
      for (const entry of parseEnvFile(content)) {
        const sanitizedValue = sanitizeConfigValue(entry.name, entry.value);

        addUnique(envFileEntries, seenEnvFile, `${entry.name}:${relativePath}:${entry.line}`, {
          name: entry.name,
          value: sanitizedValue,
          filePath: relativePath,
          line: entry.line,
          sensitive: isSensitiveConfigValue(entry.name, entry.value),
          limitLike: isTokenOrSizeLimitName(entry.name),
        });

        if (isTokenOrSizeLimitName(entry.name)) {
          addUnique(tokenAndSizeLimits, seenLimits, `${entry.name}:${relativePath}:${entry.line}`, {
            name: entry.name,
            value: sanitizedValue,
            source: "env-file",
            filePath: relativePath,
            line: entry.line,
          });
        }
      }
    }

    for (const match of content.matchAll(envVariablePattern)) {
      const name = match[1] ?? match[2];

      if (!name) {
        continue;
      }

      addUnique(environmentVariables, seenEnv, `${name}:${relativePath}`, {
        name,
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
        sensitive: isSensitiveConfigName(name),
      });
    }

    for (const match of content.matchAll(envAnyFallbackPattern)) {
      const variableName = match[2] ?? match[1];
      const fallback = sanitizeConfigValue(variableName, match[3] ?? "");

      if (!variableName || !fallback || !isTokenOrSizeLimitName(variableName)) {
        continue;
      }

      addUnique(tokenAndSizeLimits, seenLimits, `${variableName}:${relativePath}:${match.index}`, {
        name: variableName,
        value: fallback,
        source: "code-default",
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
      });
    }

    for (const match of content.matchAll(envFallbackPattern)) {
      const variableName = match[2] ?? match[1];
      const fallback = match[3] ?? "";

      if (!isSensitiveConfigName(variableName) || isPlaceholderSecret(fallback)) {
        continue;
      }

      addUnique(securityFindings, seenSecurity, `${variableName}:${relativePath}:${match.index}`, {
        type: "hardcoded-sensitive-fallback",
        variableName,
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
        recommendation:
          "Rotate the exposed value if it was committed, remove the fallback, and require an environment-provided secret.",
      });
    }
  }

  return {
    environmentVariables: environmentVariables.slice(0, 60),
    envFileEntries: envFileEntries.slice(0, 80),
    tokenAndSizeLimits: tokenAndSizeLimits.slice(0, 40),
    securityFindings: securityFindings.slice(0, 20),
  };
}

function extractPersistenceFindings(allFiles, projectRootPath) {
  const collections = [];
  const storageArtifacts = [];
  const seenCollections = new Set();
  const seenArtifacts = new Set();

  for (const filePath of allFiles.filter(isLikelyUsefulForRag).filter((item) => !isDependencyLockFile(item))) {
    const content = safeReadTextFile(filePath);

    if (!content) {
      continue;
    }

    const relativePath = getRelativePath(projectRootPath, filePath);

    for (const match of content.matchAll(collectionNamePattern)) {
      addUnique(collections, seenCollections, `mongodb-collection:${match[1]}`, {
        name: match[1],
        kind: "mongodb-collection",
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
      });
    }

    for (const match of content.matchAll(mongooseModelPattern)) {
      addUnique(collections, seenCollections, `mongoose-model:${match[1]}`, {
        name: match[1],
        kind: "mongoose-model",
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
      });
    }

    for (const match of content.matchAll(storageArtifactPattern)) {
      const artifact = match[1];

      if (
        artifact.includes("://") ||
        artifact.startsWith(".") ||
        nonStorageArtifactNames.has(getBaseName(artifact))
      ) {
        continue;
      }

      addUnique(storageArtifacts, seenArtifacts, `${artifact}:${relativePath}`, {
        name: artifact,
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
      });
    }
  }

  return {
    collections: collections.slice(0, 40),
    storageArtifacts: storageArtifacts.slice(0, 40),
  };
}

function extractRequestLimits(allFiles, projectRootPath) {
  const bodyLimits = [];
  const uploadFields = [];
  const uploadLimits = [];
  const seen = new Set();

  for (const filePath of allFiles.filter(isLikelyUsefulForRag).filter((item) => !isDependencyLockFile(item))) {
    const content = safeReadTextFile(filePath);

    if (!content) {
      continue;
    }

    const relativePath = getRelativePath(projectRootPath, filePath);

    for (const match of content.matchAll(bodyLimitPattern)) {
      addUnique(bodyLimits, seen, `body:${match[1]}:${relativePath}`, {
        value: match[1],
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
      });
    }

    for (const match of content.matchAll(uploadFieldPattern)) {
      addUnique(uploadFields, seen, `upload-field:${match[1]}:${relativePath}`, {
        fieldName: match[1],
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
      });
    }

    for (const match of content.matchAll(uploadFileSizePattern)) {
      addUnique(uploadLimits, seen, `upload-size:${match[1]}:${relativePath}`, {
        expression: match[1].trim(),
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
      });
    }
  }

  return {
    bodyLimits,
    uploadFields,
    uploadLimits,
  };
}

function extractAuthFindings(allFiles, projectRootPath) {
  const hints = [];
  const localStorageKeys = [];
  const seen = new Set();

  for (const filePath of allFiles.filter(isLikelyUsefulForRag).filter((item) => !isDependencyLockFile(item))) {
    const content = safeReadTextFile(filePath);

    if (!content) {
      continue;
    }

    const relativePath = getRelativePath(projectRootPath, filePath);
    const addHint = (name, detail) =>
      addUnique(hints, seen, `${name}:${relativePath}`, {
        name,
        detail,
        filePath: relativePath,
      });

    if (
      /\bAuthorization\b|\bBearer\b/i.test(content) &&
      /(?:auth|session|middleware|user|frontend[\\/]src[\\/]api|src[\\/]api)/i.test(relativePath)
    ) {
      addHint("bearer-token", "Authorization/Bearer token handling detected.");
    }

    if (/\bcreateHmac\b|HmacSHA|hmac/i.test(content)) {
      addHint("hmac-token", "HMAC signing or verification detected.");
    }

    if (/\bpbkdf2\b/i.test(content)) {
      addHint("pbkdf2-password-hashing", "PBKDF2 password hashing detected.");
    }

    if (/\bbcrypt\b/i.test(content)) {
      addHint("bcrypt-password-hashing", "bcrypt password hashing detected.");
    }

    if (/\bjsonwebtoken\b|\bjwt\b/i.test(content)) {
      addHint("jwt-token", "JWT-style token dependency or naming detected.");
    }

    if (/\bTTL\b|\bexpiresIn\b|\bexp\b/i.test(content) && /token|auth|session/i.test(content)) {
      addHint("token-expiration", "Token/session expiration behavior detected.");
    }

    for (const match of content.matchAll(localStorageKeyPattern)) {
      addUnique(localStorageKeys, seen, `local-storage:${match[2]}:${relativePath}`, {
        variableName: match[1],
        key: match[2],
        filePath: relativePath,
        line: getLineNumber(content, match.index ?? 0),
      });
    }
  }

  return {
    hints,
    localStorageKeys,
  };
}

function extractApiContractHints(allFiles, projectRootPath) {
  const contractFiles = [];

  for (const filePath of allFiles.filter(isLikelyUsefulForRag).filter((item) => !isDependencyLockFile(item))) {
    const normalized = filePath.replaceAll("\\", "/").toLowerCase();

    if (
      !(
        normalized.includes("/controllers/") ||
        normalized.includes("/controller/") ||
        normalized.includes("/routes/") ||
        normalized.includes("/route/") ||
        normalized.includes("/handlers/") ||
        normalized.includes("/handler/") ||
        normalized.includes("/api/") ||
        normalized.includes("server.") ||
        normalized.includes("app.")
      )
    ) {
      continue;
    }

    const content = safeReadTextFile(filePath);

    if (!content) {
      continue;
    }

    const bodyFields = uniqueValues(Array.from(content.matchAll(requestBodyFieldPattern), (match) => match[1]));
    const pathParams = uniqueValues(Array.from(content.matchAll(requestParamFieldPattern), (match) => match[1]));
    const queryParams = uniqueValues(Array.from(content.matchAll(requestQueryFieldPattern), (match) => match[1]));
    const statusCodes = uniqueValues(Array.from(content.matchAll(responseStatusPattern), (match) => match[1]));
    const responseKeys = uniqueValues(
      Array.from(content.matchAll(responseObjectPattern)).flatMap((match) =>
        Array.from(match[1].matchAll(/\b([A-Za-z_$][\w$]*)\s*:/g), (keyMatch) => keyMatch[1]),
      ),
    );

    if (
      bodyFields.length === 0 &&
      pathParams.length === 0 &&
      queryParams.length === 0 &&
      statusCodes.length === 0 &&
      responseKeys.length === 0
    ) {
      continue;
    }

    contractFiles.push({
      filePath: getRelativePath(projectRootPath, filePath),
      bodyFields,
      pathParams,
      queryParams,
      statusCodes,
      responseKeys,
    });
  }

  return contractFiles.slice(0, 30);
}

export function analyzeProject(projectRootPath) {
  const allFiles = walkFiles(projectRootPath);
  const packageJsonPaths = allFiles.filter((filePath) => path.basename(filePath) === "package.json");
  const sourceFiles = allFiles.filter((filePath) => sourceExtensions.has(path.extname(filePath).toLowerCase()));
  const javaSourceFiles = allFiles.filter((filePath) => javaSourceExtensions.has(path.extname(filePath).toLowerCase()));
  const javaBuildFilePaths = allFiles.filter((filePath) =>
    ["pom.xml", "build.gradle", "build.gradle.kts"].includes(path.basename(filePath).toLowerCase()),
  );

  const packageJsons = packageJsonPaths.map(parsePackageJson).filter(Boolean);
  const javaBuildFiles = javaBuildFilePaths
    .map((filePath) => parseJavaBuildFile(filePath, projectRootPath))
    .filter(Boolean);
  const dependencies = packageJsons.flatMap((pkg) => [
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.devDependencies),
  ]);
  const javaDependencies = javaBuildFiles.flatMap((buildFile) => buildFile.dependencies);
  const apiRoutes = [
    ...sourceFiles.flatMap((filePath) => extractRoutesFromSourceFile(filePath, projectRootPath)),
    ...javaSourceFiles.flatMap((filePath) => extractSpringRoutesFromJavaFile(filePath, projectRootPath)),
  ];
  const externalIntegrations = extractExternalIntegrations(
    allFiles,
    projectRootPath,
    packageJsons,
    javaBuildFiles,
  );
  const configuration = extractConfigurationFindings(allFiles, projectRootPath);
  const persistence = extractPersistenceFindings(allFiles, projectRootPath);
  const requestLimits = extractRequestLimits(allFiles, projectRootPath);
  const auth = extractAuthFindings(allFiles, projectRootPath);
  const apiContractHints = extractApiContractHints(allFiles, projectRootPath);
  const normalizedJavaDependencies = javaDependencies.map((dependency) => dependency.toLowerCase());

  return {
    projectName: path.basename(projectRootPath),
    rootPath: projectRootPath,
    stack: {
      hasReact: dependencies.includes("react"),
      hasNode: packageJsons.length > 0,
      hasExpress: dependencies.includes("express"),
      hasJava: javaSourceFiles.length > 0 || javaBuildFiles.length > 0,
      hasSpringBoot: normalizedJavaDependencies.some((dependency) => dependency.includes("spring-boot")),
    },
    packageJsons,
    javaBuildFiles,
    externalIntegrations,
    configuration,
    persistence,
    requestLimits,
    auth,
    apiContractHints,
    apiRoutes,
    summary: {
      fileCount: allFiles.length,
      packageJsonCount: packageJsons.length,
      javaFileCount: javaSourceFiles.length,
      javaBuildFileCount: javaBuildFiles.length,
    },
  };
}

function isLikelyUsefulForRag(filePath) {
  const baseName = path.basename(filePath).toLowerCase();
  const extension = path.extname(filePath).toLowerCase();

  if (isDependencyLockFile(filePath)) {
    return false;
  }

  if (envFileNames.has(baseName) || baseName.startsWith(".env.")) {
    return true;
  }

  if (baseName === "package.json") {
    return true;
  }

  return ragExtensions.has(extension);
}

function scoreFileForRag(relativePath) {
  let score = 0;
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();

  if (normalized.endsWith("package.json")) score += 100;
  if (normalized.endsWith("pom.xml")) score += 100;
  if (normalized.endsWith("build.gradle") || normalized.endsWith("build.gradle.kts")) score += 95;
  if (normalized.includes("/routes/")) score += 40;
  if (normalized.includes("/controllers/")) score += 30;
  if (normalized.includes("/controller/")) score += 35;
  if (normalized.includes("/services/")) score += 25;
  if (normalized.includes("/service/")) score += 30;
  if (normalized.includes("/repository/")) score += 25;
  if (normalized.includes("/config/")) score += 25;
  if (normalized.includes("/api/")) score += 25;
  if (normalized.includes("/components/")) score += 45;
  if (normalized.includes("/pages/")) score += 45;
  if (normalized.includes("/views/")) score += 45;
  if (normalized.includes("/templates/")) score += 45;
  if (normalized.includes("/styles/")) score += 55;
  if (normalized.includes("/css/")) score += 55;
  if (normalized.includes("/assets/")) score += 20;
  if (normalized.includes("/public/")) score += 20;
  if (normalized.includes("server.")) score += 20;
  if (normalized.includes("app.")) score += 20;
  if (normalized.includes("main.")) score += 15;
  if (normalized.endsWith(".css")) score += 50;
  if (normalized.endsWith(".scss")) score += 50;
  if (normalized.endsWith(".sass")) score += 50;
  if (normalized.endsWith(".less")) score += 50;
  if (normalized.endsWith(".html")) score += 45;
  if (normalized.endsWith(".jsp")) score += 45;
  if (normalized.endsWith(".vue")) score += 45;
  if (normalized.endsWith(".svelte")) score += 45;
  if (normalized.endsWith(".tsx")) score += 25;
  if (normalized.endsWith(".jsx")) score += 25;
  if (normalized.endsWith(".java")) score += 45;
  if (normalized.endsWith(".properties")) score += 20;
  if (normalized.endsWith(".yml") || normalized.endsWith(".yaml")) score += 20;
  if (normalized.endsWith(".md")) score += 10;
  if (normalized.endsWith(".env")) score += 5;

  return score;
}

function chunkText(content, chunkSize, chunkOverlap) {
  const chunks = [];
  let start = 0;

  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    const text = content.slice(start, end).trim();

    if (text) {
      chunks.push(text);
    }

    if (end >= content.length) {
      break;
    }

    start = Math.max(end - chunkOverlap, start + 1);
  }

  return chunks;
}

export function extractProjectDocuments(projectRootPath) {
  const files = walkFiles(projectRootPath)
    .filter(isLikelyUsefulForRag)
    .map((filePath) => ({
      filePath,
      relativePath: getRelativePath(projectRootPath, filePath),
    }))
    .sort((a, b) => scoreFileForRag(b.relativePath) - scoreFileForRag(a.relativePath))
    .slice(0, numberEnv("MAX_RAG_FILES"));

  const documents = [];

  for (const file of files) {
    const content = safeReadTextFile(file.filePath);
    if (!content) {
      continue;
    }

    const contentForRag =
      envFileNames.has(getBaseName(file.filePath)) || getBaseName(file.filePath).startsWith(".env.")
        ? sanitizeEnvContent(content)
        : content;
    const normalizedContent = contentForRag.slice(0, numberEnv("MAX_FILE_CHARS"));
    const chunks = chunkText(normalizedContent, numberEnv("CHUNK_SIZE"), numberEnv("CHUNK_OVERLAP"));

    chunks.forEach((chunk, index) => {
      documents.push({
        path: file.relativePath,
        chunkIndex: index,
        content: chunk,
      });
    });
  }

  return documents;
}
