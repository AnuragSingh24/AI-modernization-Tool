import fs from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { booleanEnv, numberEnv, optionalNumberEnv } from "../config/load-env.js";
import { extractProjectDocuments } from "./parser.service.js";
import { storagePaths } from "./storage.service.js";
import { createEmbeddings } from "./embedding.service.js";

let chromaModulePromise = null;
let collectionPromise = null;
let chromaStatus = {
  connected: false,
  message: "ChromaDB has not been checked yet.",
  mode: "unknown",
};

const uiSourceExtensions = new Set([
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

function hasPlaceholderApiKey() {
  return !process.env.CHROMA_API_KEY || process.env.CHROMA_API_KEY === "YOUR_API_KEY";
}

function isUiSourcePath(filePath) {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  const extension = path.extname(normalized);

  return (
    uiSourceExtensions.has(extension) ||
    normalized.includes("/components/") ||
    normalized.includes("/pages/") ||
    normalized.includes("/views/") ||
    normalized.includes("/templates/") ||
    normalized.includes("/styles/") ||
    normalized.includes("/css/")
  );
}

function scoreUiSourcePath(filePath) {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  let score = 0;

  if (normalized.includes("/styles/") || normalized.includes("/css/")) score += 50;
  if (normalized.includes("/components/")) score += 40;
  if (normalized.includes("/pages/")) score += 40;
  if (normalized.includes("/views/") || normalized.includes("/templates/")) score += 40;
  if (normalized.endsWith(".css") || normalized.endsWith(".scss") || normalized.endsWith(".sass")) score += 45;
  if (normalized.endsWith(".less") || normalized.endsWith(".styl")) score += 40;
  if (normalized.endsWith(".html") || normalized.endsWith(".jsp")) score += 35;
  if (normalized.endsWith(".tsx") || normalized.endsWith(".jsx")) score += 25;

  return score;
}

function mergeRetrievedWithUiSourceChunks(retrievedChunks, knowledgeChunks = []) {
  const existingKeys = new Set(
    retrievedChunks.map((chunk) => `${chunk.path}:${chunk.chunkIndex}`),
  );
  const uiChunks = knowledgeChunks
    .filter((chunk) => isUiSourcePath(chunk.path))
    .filter((chunk) => !existingKeys.has(`${chunk.path}:${chunk.chunkIndex}`))
    .sort((a, b) => {
      const scoreDifference = scoreUiSourcePath(b.path) - scoreUiSourcePath(a.path);
      return scoreDifference || a.path.localeCompare(b.path) || a.chunkIndex - b.chunkIndex;
    })
    .slice(0, 6)
    .map((chunk) => ({
      path: chunk.path,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      distance: null,
      score: 0,
      retrievalMode: "local-ui-source",
    }));

  return [...retrievedChunks, ...uiChunks];
}

function buildRetrievalQuery(analysis, targetStack = "React + Spring Boot") {
  const packageNames = analysis.packageJsons.flatMap((pkg) => [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const routeTerms = analysis.apiRoutes.flatMap((route) => [
    route.method,
    route.path,
    route.filePath,
  ]);

  return [
    analysis.projectName,
    targetStack,
    analysis.stack.hasReact ? "react frontend components pages hooks vite" : "",
    analysis.stack.hasNode ? "node javascript backend runtime package scripts" : "",
    analysis.stack.hasExpress ? "express routes middleware controllers api handlers" : "",
    targetStack.toLowerCase().includes("spring")
      ? "spring boot controller service repository dto validation java migration"
      : "",
    ...packageNames,
    ...routeTerms,
    "modernization architecture dependencies api routes config services controllers migration risks",
    "preserve existing ui layout styling css class names components pages workflows visual parity",
    "no redesign no new features no functionality changes language version runtime framework upgrade only",
  ]
    .filter(Boolean)
    .join(" ");
}

async function loadChroma() {
  chromaModulePromise ??= import("chromadb").catch(() => null);
  const chromaModule = await chromaModulePromise;

  if (!chromaModule?.ChromaClient) {
    return null;
  }

  return chromaModule;
}

async function getCollection() {
  if (collectionPromise) {
    return collectionPromise;
  }

  collectionPromise = (async () => {
    const chroma = await loadChroma();

    if (!chroma) {
      chromaStatus = {
        connected: false,
        message: "ChromaDB client package is unavailable.",
        mode: "unavailable",
      };
      throw new Error(chromaStatus.message);
    }

    const isCloudConfig = Boolean(
      process.env.CHROMA_API_KEY || process.env.CHROMA_TENANT || process.env.CHROMA_DATABASE,
    );

    if (isCloudConfig && hasPlaceholderApiKey()) {
      chromaStatus = {
        connected: false,
        message: "ChromaDB connection failed: CHROMA_API_KEY is missing or still set to YOUR_API_KEY.",
        mode: "unavailable",
      };
      throw new Error(chromaStatus.message);
    }

    const client = isCloudConfig
      ? new chroma.CloudClient({
          apiKey: process.env.CHROMA_API_KEY,
          host: process.env.CHROMA_HOST,
          port: optionalNumberEnv("CHROMA_PORT"),
          tenant: process.env.CHROMA_TENANT,
          database: process.env.CHROMA_DATABASE,
        })
      : new chroma.ChromaClient({
          host: process.env.CHROMA_HOST,
          port: optionalNumberEnv("CHROMA_PORT"),
          ssl: booleanEnv("CHROMA_SSL"),
        });

    const collection = await client.getOrCreateCollection({
      name: process.env.CHROMA_COLLECTION_NAME,
      embeddingFunction: null,
      metadata: {
        description: "Project chunks for modernization specification RAG",
      },
    });

    chromaStatus = {
      connected: true,
      message: `ChromaDB connected successfully using ${isCloudConfig ? "cloud" : "local"} mode.`,
      mode: isCloudConfig ? "cloud" : "local",
    };

    return collection;
  })().catch((error) => {
    collectionPromise = null;
    chromaStatus = {
      connected: false,
      message: `ChromaDB connection failed: ${error.message}`,
      mode: "unavailable",
    };
    console.warn(`ChromaDB connection unavailable: ${error.message}`);
    throw error;
  });

  return collectionPromise;
}

export async function checkChromaConnection() {
  try {
    const collection = await getCollection();

    if (!collection) {
      return { ...chromaStatus };
    }

    return { ...chromaStatus };
  } catch {
    return { ...chromaStatus };
  }
}

export function getChromaConnectionStatus() {
  return { ...chromaStatus };
}

async function storeChunksInChroma({ projectId, chunks, embeddings }) {
  const collection = await getCollection();

  if (chunks.length === 0) {
    return {
      collectionName: process.env.CHROMA_COLLECTION_NAME,
      chunkCount: 0,
    };
  }

  if (embeddings.length !== chunks.length) {
    throw new Error(
      `Embedding count mismatch. Expected ${chunks.length} embeddings but received ${embeddings.length}.`,
    );
  }

  const ids = chunks.map((_, index) => `${projectId}-${index}`);
  const documents = chunks.map((chunk) => chunk.content);
  const metadatas = chunks.map((chunk, index) => ({
    projectId,
    path: chunk.path,
    chunkIndex: chunk.chunkIndex,
    sourceOrder: index,
  }));

  await collection.upsert({
    ids,
    embeddings,
    documents,
    metadatas,
  });

  return {
    collectionName: process.env.CHROMA_COLLECTION_NAME,
    chunkCount: chunks.length,
  };
}

async function retrieveWithChroma({ projectId, analysis, targetStack }) {
  const collection = await getCollection();
  const queryText = buildRetrievalQuery(analysis, targetStack);
  const [queryEmbedding] = await createEmbeddings([queryText]);

  if (!queryEmbedding) {
    throw new Error("Query embedding generation failed.");
  }

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: numberEnv("RAG_TOP_K"),
    where: { projectId },
    include: ["documents", "metadatas", "distances"],
  });

  const documents = results.documents?.[0] ?? [];
  const metadatas = results.metadatas?.[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  return documents
    .map((document, index) => {
      const metadata = metadatas[index];

      if (!document || !metadata) {
        return null;
      }

      return {
        path: String(metadata.path ?? "unknown"),
        chunkIndex: Number(metadata.chunkIndex ?? index),
        content: document,
        distance: distances[index] ?? null,
        score: distances[index] == null ? 0 : 1 / (1 + distances[index]),
        retrievalMode: "chroma",
      };
    })
    .filter(Boolean);
}

function tokenizeForLocalRetrieval(text) {
  return Array.from(
    new Set(
      String(text ?? "")
        .toLowerCase()
        .split(/[^a-z0-9_./-]+/)
        .filter((token) => token.length > 2),
    ),
  );
}

function retrieveWithLocalScoring({ chunks, analysis, targetStack }) {
  const queryText = buildRetrievalQuery(analysis, targetStack);
  const queryTokens = tokenizeForLocalRetrieval(queryText);

  if (chunks.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => {
      const haystack = `${chunk.path}\n${chunk.content}`.toLowerCase();
      const matchCount = queryTokens.reduce(
        (total, token) => total + (haystack.includes(token) ? 1 : 0),
        0,
      );
      const uiBoost = isUiSourcePath(chunk.path) ? 4 : 0;
      const score = matchCount + uiBoost + scoreUiSourcePath(chunk.path) / 100;

      return {
        path: chunk.path,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        distance: null,
        score,
        retrievalMode: "local",
      };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.chunkIndex - b.chunkIndex)
    .slice(0, numberEnv("RAG_TOP_K"));
}

export async function storeProjectContext({ projectName, archiveName, projectRootPath, analysis }) {
  const projectId = uuidv4();
  const chunks = extractProjectDocuments(projectRootPath);
  let vectorStore = null;
  let ragMode = "local";

  try {
    const embeddings = await createEmbeddings(
      chunks.map((chunk) => `File: ${chunk.path}\nChunk: ${chunk.chunkIndex}\n\n${chunk.content}`),
    );

    if (chunks.length > 0 && embeddings.length > 0) {
      vectorStore = await storeChunksInChroma({ projectId, chunks, embeddings });
      ragMode = "chroma";
    } else if (chunks.length > 0) {
      chromaStatus = {
        connected: false,
        message: "OpenAI embeddings were unavailable; using local keyword RAG fallback.",
        mode: "local",
      };
    }
  } catch (error) {
    chromaStatus = {
      connected: false,
      message: `Vector RAG unavailable; using local keyword RAG fallback. ${error.message}`,
      mode: "local",
    };
    console.warn(chromaStatus.message);
  }

  const knowledge = {
    projectId,
    projectName,
    archiveName,
    createdAt: new Date().toISOString(),
    ragMode,
    vectorStore,
    analysis,
    chunks,
  };

  const outputPath = path.join(storagePaths.knowledge, `${projectId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(knowledge, null, 2), "utf8");

  return {
    projectId,
    chunkCount: chunks.length,
    outputPath,
    ragMode,
    vectorStore,
  };
}

export async function retrieveRelevantContext({ projectId, analysis, targetStack }) {
  const knowledgePath = path.join(storagePaths.knowledge, `${projectId}.json`);

  if (!fs.existsSync(knowledgePath)) {
    throw new Error(`Knowledge file not found for project ${projectId}.`);
  }

  const knowledge = JSON.parse(fs.readFileSync(knowledgePath, "utf8"));
  let retrievedChunks = [];

  if (knowledge.ragMode === "chroma") {
    try {
      retrievedChunks = await retrieveWithChroma({ projectId, analysis, targetStack });
    } catch (error) {
      chromaStatus = {
        connected: false,
        message: `Chroma retrieval failed; using local keyword RAG fallback. ${error.message}`,
        mode: "local",
      };
      console.warn(chromaStatus.message);
    }
  }

  if (retrievedChunks.length === 0) {
    retrievedChunks = retrieveWithLocalScoring({
      chunks: knowledge.chunks ?? [],
      analysis,
      targetStack,
    });
  }

  return mergeRetrievedWithUiSourceChunks(retrievedChunks, knowledge.chunks);
}

export function readStoredProjectContext(projectId) {
  const knowledgePath = path.join(storagePaths.knowledge, `${projectId}.json`);

  if (!fs.existsSync(knowledgePath)) {
    throw new Error(`Knowledge file not found for project ${projectId}.`);
  }

  return JSON.parse(fs.readFileSync(knowledgePath, "utf8"));
}
