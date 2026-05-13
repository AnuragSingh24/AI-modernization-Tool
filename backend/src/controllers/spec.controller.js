import fs from "node:fs";
import { analyzeProject } from "../services/parser.service.js";
import {
  readStoredProjectContext,
  retrieveRelevantContext,
  storeProjectContext,
} from "../services/chroma-rag.service.js";
import { generateModernizationSpec } from "../services/openai.service.js";
import { getSavedSpecPath, saveGeneratedSpec } from "../services/spec.service.js";
import { buildUiReference } from "../services/ui-reference.service.js";
import { extractZip } from "../services/zip.service.js";
import { removeDir } from "../utils/file-system.js";

const defaultTargetStack = "React + Spring Boot";
const defaultFrontendTargetVersion = "React 19.2.6";
const defaultBackendTargetVersion = "Java 21 LTS + Spring Boot 3.5.x";

function logSpecEvent(label, details) {
  console.log(`[spec] ${label}: ${details}`);
}

function normalizeTargetStack(value) {
  if (typeof value !== "string") {
    return defaultTargetStack;
  }

  const trimmedValue = value.trim();
  return trimmedValue || defaultTargetStack;
}

function normalizeVersionTarget(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
}

function findDeclaredVersion(packageJsons, packageName) {
  for (const pkg of packageJsons) {
    const version = pkg.dependencies?.[packageName] ?? pkg.devDependencies?.[packageName];
    if (version) {
      return version;
    }
  }

  return undefined;
}

function findPackageName(packageJsons, packageName) {
  return findDeclaredVersion(packageJsons, packageName) ? packageName : undefined;
}

function findNodeEngine(packageJsons) {
  for (const pkg of packageJsons) {
    if (typeof pkg.engines?.node === "string") {
      return pkg.engines.node;
    }
  }

  return process.version;
}

function buildVersionAssessment(analysis, targets) {
  const frontendName =
    findPackageName(analysis.packageJsons, "react") ??
    findPackageName(analysis.packageJsons, "next") ??
    findPackageName(analysis.packageJsons, "vue") ??
    "Unknown frontend";

  const frontendCurrentVersion =
    findDeclaredVersion(analysis.packageJsons, frontendName) ??
    findDeclaredVersion(analysis.packageJsons, "@vitejs/plugin-react") ??
    "Unknown";

  const backendName =
    findPackageName(analysis.packageJsons, "express") ??
    findPackageName(analysis.packageJsons, "fastify") ??
    "Node.js backend";

  const backendCurrentVersion = findDeclaredVersion(analysis.packageJsons, backendName) ?? "Unknown";

  return {
    frontend: {
      name: frontendName,
      currentVersion: frontendCurrentVersion,
      targetVersion: targets.frontendTargetVersion,
    },
    backend: {
      name: backendName,
      currentVersion: backendCurrentVersion,
      targetVersion: targets.backendTargetVersion,
    },
    runtime: {
      name: "Node.js",
      currentVersion: findNodeEngine(analysis.packageJsons),
      targetVersion: targets.backendTargetVersion.includes("Node.js")
        ? targets.backendTargetVersion
        : "Target backend is not Node.js",
    },
  };
}

export async function createSpecification(req, res) {
  if (!req.file) {
    res.status(400).json({ error: "ZIP file is required." });
    return;
  }

  if (!req.file.originalname.toLowerCase().endsWith(".zip")) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: "Only ZIP files are supported." });
    return;
  }

  const extractedProject = extractZip(req.file.path);
  logSpecEvent("upload.received", `archive=${req.file.originalname}`);
  logSpecEvent("zip.extracted", `root=${extractedProject.projectRootPath}`);

  try {
    const targetStack = normalizeTargetStack(req.body?.targetStack);
    const targetVersions = {
      frontendTargetVersion: normalizeVersionTarget(
        req.body?.frontendTargetVersion,
        defaultFrontendTargetVersion,
      ),
      backendTargetVersion: normalizeVersionTarget(
        req.body?.backendTargetVersion,
        defaultBackendTargetVersion,
      ),
    };
    const analysis = analyzeProject(extractedProject.projectRootPath);
    const versionAssessment = buildVersionAssessment(analysis, targetVersions);
    const specTargetStack = `${targetStack}
Frontend target version: ${versionAssessment.frontend.targetVersion}
Backend target version: ${versionAssessment.backend.targetVersion}
Detected frontend current version: ${versionAssessment.frontend.name} ${versionAssessment.frontend.currentVersion}
Detected backend current version: ${versionAssessment.backend.name} ${versionAssessment.backend.currentVersion}`;
    logSpecEvent(
      "analysis.completed",
      `project=${analysis.projectName} files=${analysis.summary.fileCount} packages=${analysis.summary.packageJsonCount} routes=${analysis.apiRoutes.length} target="${targetStack}" frontendTarget="${targetVersions.frontendTargetVersion}" backendTarget="${targetVersions.backendTargetVersion}"`,
    );

    const storedContext = await storeProjectContext({
      projectName: analysis.projectName,
      archiveName: req.file.originalname,
      projectRootPath: extractedProject.projectRootPath,
      analysis,
    });
    logSpecEvent(
      "context.stored",
      `projectId=${storedContext.projectId} chunks=${storedContext.chunkCount} ragMode=${storedContext.ragMode ?? "unknown"}`,
    );

    const retrievedChunks = await retrieveRelevantContext({
      projectId: storedContext.projectId,
      analysis,
      targetStack: specTargetStack,
    });
    logSpecEvent("context.retrieved", `retrievedChunks=${retrievedChunks.length}`);

    const storedProjectContext = readStoredProjectContext(storedContext.projectId);
    const uiReference = buildUiReference(storedProjectContext.chunks ?? [], analysis);
    logSpecEvent(
      "ui.reference.extracted",
      `files=${uiReference.files.length} components=${uiReference.components.length} classes=${uiReference.classes.length} styling="${uiReference.stylingSystem.primary}"`,
    );

    if (retrievedChunks.length > 0) {
      retrievedChunks.forEach((chunk, index) => {
        logSpecEvent(
          `context.chunk.${index + 1}`,
          `file=${chunk.path} chunkIndex=${chunk.chunkIndex} mode=${chunk.retrievalMode ?? "unknown"}`,
        );
      });
    } else {
      logSpecEvent("context.chunk", "No context chunks retrieved. Using parsed analysis only.");
    }

    const { markdown, telemetry } = await generateModernizationSpec(
      analysis,
      retrievedChunks,
      specTargetStack,
      uiReference,
    );
    logSpecEvent(
      "openai.tokens",
      `provider=${telemetry.provider} model=${telemetry.model ?? "fallback"} promptEstimate=${telemetry.promptTokenEstimate} input=${telemetry.inputTokens} output=${telemetry.outputTokens} total=${telemetry.totalTokens}`,
    );

    const generatedSpec = saveGeneratedSpec(markdown, analysis);
    logSpecEvent(
      "spec.saved",
      `master=${generatedSpec.outputPath} pack=${generatedSpec.downloadPath} files=${generatedSpec.specFileCount}`,
    );
    generatedSpec.specFiles.forEach((specFile, index) => {
      logSpecEvent(`spec.file.${index + 1}`, `kind=${specFile.kind} file=${specFile.fileName}`);
    });

    res.json({
      ...generatedSpec,
      targetStack,
      versionAssessment,
      stylingAssessment: uiReference.stylingSystem,
      ragMode: retrievedChunks[0]?.retrievalMode ?? storedContext.ragMode,
      projectId: storedContext.projectId,
      contextChunkCount: storedContext.chunkCount,
      retrievedChunkCount: retrievedChunks.length,
      tokenUsage: telemetry,
    });
  } catch (error) {
    logSpecEvent("request.failed", error instanceof Error ? error.message : "Unknown error");
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Specification generation failed while using vector retrieval.",
    });
  } finally {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    removeDir(extractedProject.extractionPath);
  }
}

export function downloadSpecification(req, res) {
  const downloadId = Array.isArray(req.params.downloadId)
    ? req.params.downloadId[0]
    : req.params.downloadId;

  const specPath = getSavedSpecPath(downloadId);

  if (!fs.existsSync(specPath)) {
    res.status(404).json({ error: "Generated spec not found." });
    return;
  }

  res.download(specPath, "modernization-spec-pack.zip");
}
