import { numberEnv } from "./config/load-env.js";
import { createApp } from "./app.js";
import { checkChromaConnection } from "./services/chroma-rag.service.js";
import { initializeStorage } from "./services/storage.service.js";

initializeStorage();

const app = createApp();
const port = numberEnv("PORT");

app.listen(port, async () => {
  console.log(`Backend listening on http://localhost:${port}`);

  const chromaStatus = await checkChromaConnection();
  console.log(chromaStatus.message);
});
