import cors from "cors";
import express from "express";
import { csvEnv } from "./config/load-env.js";
import { specRouter } from "./routes/spec.routes.js";
import { getChromaConnectionStatus } from "./services/chroma-rag.service.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: csvEnv("FRONTEND_ORIGIN"),
    }),
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      chroma: getChromaConnectionStatus(),
    });
  });

  app.use("/api/spec", specRouter);

  return app;
}
