import path from "node:path";
import { ensureDir } from "../utils/file-system.js";

const projectRoot = process.cwd();

export const storagePaths = {
  uploads: path.join(projectRoot, "uploads"),
  extracted: path.join(projectRoot, "tmp", "extracted"),
  knowledge: path.join(projectRoot, "tmp", "knowledge"),
  specs: path.join(projectRoot, "tmp", "specs"),
};

export function initializeStorage() {
  ensureDir(storagePaths.uploads);
  ensureDir(storagePaths.extracted);
  ensureDir(storagePaths.knowledge);
  ensureDir(storagePaths.specs);
}
