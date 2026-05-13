import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import { ensureDir } from "../utils/file-system.js";
import { storagePaths } from "./storage.service.js";

function findProjectRoot(extractionPath) {
  const entries = fs
    .readdirSync(extractionPath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("__MACOSX"));

  if (entries.length === 1 && entries[0]?.isDirectory()) {
    return path.join(extractionPath, entries[0].name);
  }

  return extractionPath;
}

export function extractZip(zipFilePath) {
  const extractionId = uuidv4();
  const extractionPath = path.join(storagePaths.extracted, extractionId);
  ensureDir(extractionPath);

  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(extractionPath, true);

  return {
    extractionId,
    extractionPath,
    projectRootPath: findProjectRoot(extractionPath),
  };
}
