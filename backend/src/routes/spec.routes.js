import { Router } from "express";
import multer from "multer";
import { createSpecification, downloadSpecification } from "../controllers/spec.controller.js";
import { storagePaths } from "../services/storage.service.js";

const upload = multer({ dest: storagePaths.uploads });
export const specRouter = Router();

specRouter.post("/generate", upload.single("projectZip"), createSpecification);
specRouter.get("/download/:downloadId", downloadSpecification);
