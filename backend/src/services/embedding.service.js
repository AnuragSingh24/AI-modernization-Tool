import OpenAI from "openai";
import { numberEnv } from "../config/load-env.js";

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

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));

  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

export async function createEmbeddings(texts) {
  const openAiClient = getClient();

  if (!openAiClient || texts.length === 0) {
    return [];
  }

  const embeddings = [];
  const embeddingBatchSize = numberEnv("EMBEDDING_BATCH_SIZE");

  for (let index = 0; index < texts.length; index += embeddingBatchSize) {
    const batch = texts.slice(index, index + embeddingBatchSize);
    const response = await openAiClient.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL,
      input: batch,
    });

    embeddings.push(...response.data.map((item) => normalizeVector(item.embedding)));
  }

  return embeddings;
}
