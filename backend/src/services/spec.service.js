import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import { storagePaths } from "./storage.service.js";

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function splitMarkdownIntoSections(markdown) {
  const normalizedMarkdown = markdown.replace(/\r\n/g, "\n");
  const lines = normalizedMarkdown.split("\n");
  const sections = [];
  const introLines = [];
  let title = "Modernization Specification";
  let currentSection = null;

  for (const line of lines) {
    if (!title && line.startsWith("# ")) {
      title = line.slice(2).trim() || title;
    }

    if (line.startsWith("# ")) {
      title = line.slice(2).trim() || title;
      continue;
    }

    if (line.startsWith("## ")) {
      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = {
        title: line.slice(3).trim() || "Section",
        lines: [],
      };
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    } else {
      introLines.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  if (sections.length === 0) {
    sections.push({
      title: "Full Specification",
      lines: normalizedMarkdown.split("\n"),
    });
  }

  return {
    title,
    intro: introLines.join("\n").trim(),
    sections: sections.map((section, index) => ({
      index,
      title: section.title,
      content: section.lines.join("\n").trim(),
    })),
  };
}

function buildSectionFileName(index, title) {
  return `sections/${String(index + 1).padStart(2, "0")}-${slugify(title || `section-${index + 1}`)}.md`;
}

function buildSectionMarkdown(title, content) {
  return `# ${title}\n\n${content || "_No content generated for this section._"}\n`;
}

function buildMasterMarkdown({ title, intro, sectionFiles }) {
  const introBlock = intro ? `${intro}\n\n` : "";
  const sectionIndex = sectionFiles
    .map(
      (section) =>
        `- [${section.title}](${section.fileName})${section.summary ? ` - ${section.summary}` : ""}`,
    )
    .join("\n");

  return `# ${title}

${introBlock}## Spec Pack

This master file is the entry point for the modernization specification pack.
Open the linked section files below for the full detail when the project is large.

${sectionIndex}
`;
}

function summarizeSection(content) {
  const normalized = content.replace(/\n+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > 110 ? `${normalized.slice(0, 107)}...` : normalized;
}

export function saveGeneratedSpec(markdown, analysis) {
  const downloadId = uuidv4();
  const masterFileName = "modernization-spec.md";
  const packFileName = "modernization-spec-pack.zip";
  const outputDir = path.join(storagePaths.specs, downloadId);
  const outputPath = path.join(outputDir, masterFileName);
  const downloadPath = path.join(storagePaths.specs, `${downloadId}-${packFileName}`);
  const sectionDir = path.join(outputDir, "sections");
  const parsedSpec = splitMarkdownIntoSections(markdown);

  fs.mkdirSync(sectionDir, { recursive: true });

  const sectionFiles = parsedSpec.sections.map((section) => {
    const fileName = buildSectionFileName(section.index, section.title);
    const filePath = path.join(outputDir, fileName);
    const fileContent = buildSectionMarkdown(section.title, section.content);

    fs.writeFileSync(filePath, fileContent, "utf8");

    return {
      title: section.title,
      fileName,
      summary: summarizeSection(section.content),
    };
  });

  const masterMarkdown = buildMasterMarkdown({
    title: parsedSpec.title,
    intro: parsedSpec.intro,
    sectionFiles,
  });

  fs.writeFileSync(outputPath, masterMarkdown, "utf8");

  const zip = new AdmZip();
  zip.addLocalFolder(outputDir);
  zip.writeZip(downloadPath);

  return {
    markdown: masterMarkdown,
    fileName: masterFileName,
    packFileName,
    analysis,
    downloadId,
    outputPath,
    downloadPath,
    specFileCount: sectionFiles.length + 1,
    specFiles: [
      { title: parsedSpec.title, fileName: masterFileName, kind: "master" },
      ...sectionFiles.map((section) => ({
        title: section.title,
        fileName: section.fileName,
        kind: "section",
      })),
    ],
  };
}

export function getSavedSpecPath(downloadId) {
  return path.join(storagePaths.specs, `${downloadId}-modernization-spec-pack.zip`);
}
