import path from "node:path";

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

const layoutTags = [
  "header",
  "nav",
  "main",
  "section",
  "article",
  "aside",
  "footer",
  "form",
  "table",
  "ul",
  "ol",
];

const controlTags = ["button", "input", "select", "textarea", "label", "a"];
const visibleTextAttributes = ["aria-label", "alt", "placeholder", "title", "value"];
const tailwindResponsivePrefixes = ["sm:", "md:", "lg:", "xl:", "2xl:", "max-sm:", "max-md:", "max-lg:"];
const tailwindSpacingPrefixes = ["p-", "px-", "py-", "pt-", "pr-", "pb-", "pl-", "m-", "mx-", "my-", "mt-", "mr-", "mb-", "ml-", "gap-", "space-x-", "space-y-", "w-", "h-", "min-h-", "max-w-"];
const tailwindColorPrefixes = ["bg-", "text-", "border-", "ring-", "from-", "via-", "to-", "fill-", "stroke-"];
const tailwindTypographyPrefixes = ["font-", "text-", "leading-", "tracking-", "uppercase", "lowercase", "capitalize"];
const bootstrapClassNames = new Set([
  "accordion",
  "alert",
  "badge",
  "breadcrumb",
  "btn",
  "btn-primary",
  "btn-secondary",
  "card",
  "carousel",
  "col",
  "container",
  "container-fluid",
  "dropdown",
  "form-control",
  "form-group",
  "input-group",
  "modal",
  "navbar",
  "nav-link",
  "offcanvas",
  "popover",
  "row",
  "spinner-border",
  "table",
  "toast",
  "tooltip",
]);

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function isUiSourcePath(filePath) {
  const normalized = normalizePath(filePath).toLowerCase();
  const extension = path.extname(normalized);

  return (
    uiSourceExtensions.has(extension) ||
    normalized.includes("/components/") ||
    normalized.includes("/pages/") ||
    normalized.includes("/views/") ||
    normalized.includes("/templates/") ||
    normalized.includes("/styles/") ||
    normalized.includes("/css/") ||
    normalized.includes("/assets/") ||
    normalized.includes("/public/")
  );
}

function getDependencyNames(analysis) {
  return new Set(
    (analysis?.packageJsons ?? [])
      .flatMap((pkg) => [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ])
      .map((name) => name.toLowerCase()),
  );
}

function addStylingEvidence(map, system, evidence) {
  const entries = map.get(system) ?? [];
  entries.push(evidence);
  map.set(system, entries);
}

function hasAnyDependency(dependencies, names) {
  return names.some((name) => dependencies.has(name.toLowerCase()));
}

function looksLikeTailwindClass(token) {
  return (
    tailwindResponsivePrefixes.some((prefix) => token.startsWith(prefix)) ||
    tailwindSpacingPrefixes.some((prefix) => token.startsWith(prefix)) ||
    tailwindColorPrefixes.some((prefix) => token.startsWith(prefix)) ||
    tailwindTypographyPrefixes.some((prefix) => token === prefix || token.startsWith(prefix)) ||
    /^(flex|grid|hidden|block|inline-flex|items-|justify-|rounded|shadow|transition|duration-|ease-|opacity-|overflow-|z-|relative|absolute|sticky|fixed)$/.test(
      token,
    )
  );
}

function buildStylingSystemReference(chunks = [], analysis = null, classTokens = []) {
  const dependencies = getDependencyNames(analysis);
  const evidenceBySystem = new Map();
  const normalizedClassTokens = classTokens.map((token) => token.toLowerCase());

  if (hasAnyDependency(dependencies, ["tailwindcss", "@tailwindcss/vite", "@tailwindcss/postcss"])) {
    addStylingEvidence(evidenceBySystem, "Tailwind CSS", "tailwind dependency found in package.json");
  }

  if (hasAnyDependency(dependencies, ["bootstrap", "react-bootstrap", "reactstrap", "ngx-bootstrap"])) {
    addStylingEvidence(evidenceBySystem, "Bootstrap", "bootstrap dependency found in package.json");
  }

  if (hasAnyDependency(dependencies, ["sass", "node-sass"])) {
    addStylingEvidence(evidenceBySystem, "SCSS/Sass", "sass dependency found in package.json");
  }

  if (hasAnyDependency(dependencies, ["styled-components", "@emotion/react", "@emotion/styled"])) {
    addStylingEvidence(evidenceBySystem, "CSS-in-JS", "CSS-in-JS dependency found in package.json");
  }

  for (const chunk of chunks) {
    if (!chunk?.path || !chunk?.content) {
      continue;
    }

    const normalizedPath = normalizePath(chunk.path).toLowerCase();
    const extension = path.extname(normalizedPath);

    if (normalizedPath.includes("tailwind.config") || /@tailwind\b|@config\s+["'].*tailwind|from\s+["']tailwindcss["']/.test(chunk.content)) {
      addStylingEvidence(evidenceBySystem, "Tailwind CSS", `${chunk.path} contains Tailwind config or directives`);
    }

    if (/bootstrap(?:\.min)?\.css|from\s+["']bootstrap|["']bootstrap\/dist\/css\/bootstrap/.test(chunk.content)) {
      addStylingEvidence(evidenceBySystem, "Bootstrap", `${chunk.path} imports Bootstrap styles`);
    }

    if (extension === ".scss" || extension === ".sass" || /@use\s+["'][^"']+["']|@mixin\b|@include\b|\$[a-zA-Z0-9_-]+\s*:/.test(chunk.content)) {
      addStylingEvidence(evidenceBySystem, "SCSS/Sass", `${chunk.path} uses Sass syntax or file extension`);
    }

    if (/\.module\.(css|scss|sass)$/.test(normalizedPath) || /import\s+\w+\s+from\s+["'][^"']+\.module\.(css|scss|sass)["']/.test(chunk.content)) {
      addStylingEvidence(evidenceBySystem, "CSS Modules", `${chunk.path} uses CSS Module naming/imports`);
    }

    if (extension === ".css" && !normalizedPath.endsWith(".module.css")) {
      addStylingEvidence(evidenceBySystem, "Plain CSS", `${chunk.path} is a global/plain CSS stylesheet`);
    }
  }

  const tailwindClassCount = normalizedClassTokens.filter(looksLikeTailwindClass).length;
  if (tailwindClassCount >= 8) {
    addStylingEvidence(evidenceBySystem, "Tailwind CSS", `${tailwindClassCount} utility-style class names detected`);
  }

  const bootstrapClassCount = normalizedClassTokens.filter((token) => bootstrapClassNames.has(token)).length;
  if (bootstrapClassCount >= 3) {
    addStylingEvidence(evidenceBySystem, "Bootstrap", `${bootstrapClassCount} Bootstrap class names detected`);
  }

  const systems = Array.from(evidenceBySystem.entries()).map(([name, evidence]) => ({
    name,
    evidence: unique(evidence, 8),
  }));

  return {
    primary: inferPrimaryStylingSystem(systems),
    systems,
  };
}

function inferPrimaryStylingSystem(systems) {
  const priority = ["Tailwind CSS", "Bootstrap", "SCSS/Sass", "CSS Modules", "CSS-in-JS", "Plain CSS"];
  const names = new Set(systems.map((system) => system.name));
  const orderedSystems = priority.filter((name) => names.has(name));

  if (orderedSystems.length === 0) {
    return "Unknown styling system";
  }

  if (orderedSystems.length === 1) {
    return orderedSystems[0];
  }

  return `${orderedSystems[0]} with ${orderedSystems.slice(1).join(", ")}`;
}

function unique(values, limit = 40) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

function getRegexMatches(content, regex, mapper = (match) => match[1]) {
  return Array.from(content.matchAll(regex), mapper).filter(Boolean);
}

function splitClassValue(value) {
  return value
    .replace(/[{}"'`]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function extractClassTokens(content) {
  const classValues = [
    ...getRegexMatches(content, /\bclassName\s*=\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`|\{["'`]([^"'`]+)["'`]\})/g, (match) => match[1] || match[2] || match[3] || match[4]),
    ...getRegexMatches(content, /\bclass\s*=\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g, (match) => match[1] || match[2] || match[3]),
  ];
  const cssSelectors = getRegexMatches(content, /\.([_a-zA-Z][\w-]*)\s*[{,.#:[\s]/g);

  return unique([...classValues.flatMap(splitClassValue), ...cssSelectors], 80);
}

function extractComponentNames(content, filePath) {
  const fromDeclarations = [
    ...getRegexMatches(content, /\bfunction\s+([A-Z][A-Za-z0-9_]*)\s*\(/g),
    ...getRegexMatches(content, /\b(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[^=]+)=>/g),
    ...getRegexMatches(content, /\bexport\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g),
    ...getRegexMatches(content, /\bclass\s+([A-Z][A-Za-z0-9_]*)\s+extends\b/g),
  ];
  const extension = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath, extension);

  if (fromDeclarations.length > 0) {
    return unique(fromDeclarations, 12);
  }

  return /^[A-Z]/.test(basename) ? [basename] : [];
}

function extractLayout(content) {
  const usedTags = layoutTags.filter((tag) => new RegExp(`<${tag}\\b`, "i").test(content));
  const jsxComponents = getRegexMatches(content, /<([A-Z][A-Za-z0-9_.]*)\b/g);
  const rootReturns = getRegexMatches(content, /return\s*\(\s*<([A-Za-z][A-Za-z0-9_.-]*)\b/g);

  return {
    tags: unique(usedTags, 20),
    components: unique(jsxComponents, 24),
    roots: unique(rootReturns, 8),
  };
}

function extractCssValues(content) {
  const cssVariables = getRegexMatches(content, /(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g, (match) => `${match[1]}: ${match[2].trim()}`);
  const colorValues = getRegexMatches(content, /(?:#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\))/g, (match) => match[0]);
  const fontValues = getRegexMatches(content, /(font-(?:family|size|weight|style)|line-height|letter-spacing)\s*:\s*([^;]+);/g, (match) => `${match[1]}: ${match[2].trim()}`);
  const spacingValues = getRegexMatches(content, /\b(margin|padding|gap|row-gap|column-gap|width|height|min-height|max-width|border-radius)\s*:\s*([^;]+);/g, (match) => `${match[1]}: ${match[2].trim()}`);

  return { cssVariables, colorValues, fontValues, spacingValues };
}

function cleanVisibleText(value) {
  return String(value ?? "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeVisibleText(value) {
  if (!value || value.length < 2 || value.length > 140) {
    return false;
  }

  if (/^[{}()[\].,;:+\-*/#_0-9\s]+$/.test(value)) {
    return false;
  }

  if (/^(?:className|class|id|href|src|type|key|ref|style|role)$/i.test(value)) {
    return false;
  }

  if (/^[a-zA-Z0-9_-]+\.(?:js|jsx|ts|tsx|css|scss|png|jpg|jpeg|svg|json)$/.test(value)) {
    return false;
  }

  return /[A-Za-z]/.test(value);
}

function extractVisibleText(content) {
  const textBetweenTags = getRegexMatches(content, />\s*([^<>{}\n][^<>{}\n]{1,140})\s*</g, (match) =>
    cleanVisibleText(match[1]),
  );
  const attributeText = visibleTextAttributes.flatMap((attribute) =>
    getRegexMatches(
      content,
      new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]+)"|'([^']+)')`, "gi"),
      (match) => cleanVisibleText(match[1] || match[2]),
    ),
  );
  const stringTextInJsxExpressions = getRegexMatches(
    content,
    /\{\s*["'`]([^"'`{}]{2,140})["'`]\s*\}/g,
    (match) => cleanVisibleText(match[1]),
  );

  return unique([...textBetweenTags, ...attributeText, ...stringTextInJsxExpressions].filter(looksLikeVisibleText), 120);
}

function extractIcons(content) {
  const iconImports = getRegexMatches(content, /import\s+\{([^}]+)\}\s+from\s+["']([^"']*(?:icon|lucide|heroicons|fontawesome|material)[^"']*)["']/gi, (match) =>
    `${match[2]}: ${match[1].split(",").map((item) => item.trim()).filter(Boolean).join(", ")}`,
  );
  const iconComponents = getRegexMatches(content, /<([A-Z][A-Za-z0-9]*(?:Icon|Svg|Glyph))\b/g);
  const iconClasses = extractClassTokens(content).filter((token) => /(?:icon|glyph|svg|fa-|lucide|material)/i.test(token));

  return unique([...iconImports, ...iconComponents, ...iconClasses], 30);
}

function extractControls(content) {
  return controlTags
    .filter((tag) => new RegExp(`<${tag}\\b`, "i").test(content) || new RegExp(`\\b${tag}\\b[^{]*\\{`, "i").test(content))
    .map((tag) => {
      const classMatches = getRegexMatches(
        content,
        new RegExp(`<${tag}\\b[^>]*(?:className|class)\\s*=\\s*["']([^"']+)["']`, "gi"),
      );
      const classes = unique(classMatches.flatMap(splitClassValue), 12);
      return classes.length ? `${tag}: ${classes.join(" ")}` : tag;
    });
}

function extractResponsiveBehavior(content, classTokens) {
  const mediaQueries = getRegexMatches(content, /@media[^{]+\{/g, (match) => match[0].replace(/\s*\{$/, "").trim());
  const containerQueries = getRegexMatches(content, /@container[^{]*\{/g, (match) => match[0].replace(/\s*\{$/, "").trim());
  const responsiveClasses = classTokens.filter((token) =>
    tailwindResponsivePrefixes.some((prefix) => token.startsWith(prefix)),
  );

  return unique([...mediaQueries, ...containerQueries, ...responsiveClasses], 36);
}

function extractFileReference(chunk) {
  const classTokens = extractClassTokens(chunk.content);
  const cssValues = extractCssValues(chunk.content);
  const normalizedPath = normalizePath(chunk.path).toLowerCase();

  return {
    path: chunk.path,
    chunkIndex: chunk.chunkIndex,
    isStylesheet: [".css", ".scss", ".sass", ".less", ".styl"].includes(path.extname(normalizedPath)),
    components: extractComponentNames(chunk.content, chunk.path),
    layout: extractLayout(chunk.content),
    visibleText: extractVisibleText(chunk.content),
    classes: classTokens,
    themeColors: unique([
      ...cssValues.cssVariables.filter((value) => /color|brand|accent|ink|muted|line|panel|danger|background/i.test(value)),
      ...cssValues.colorValues,
      ...classTokens.filter((token) => tailwindColorPrefixes.some((prefix) => token.includes(prefix))),
    ], 36),
    typography: unique([
      ...cssValues.fontValues,
      ...classTokens.filter((token) => tailwindTypographyPrefixes.some((prefix) => token === prefix || token.startsWith(prefix))),
    ], 28),
    spacing: unique([
      ...cssValues.spacingValues,
      ...classTokens.filter((token) => tailwindSpacingPrefixes.some((prefix) => token.includes(prefix))),
    ], 32),
    icons: extractIcons(chunk.content),
    controls: extractControls(chunk.content),
    responsive: extractResponsiveBehavior(chunk.content, classTokens),
  };
}

function mergeReferences(references) {
  return {
    files: references.map((reference) => reference.path),
    stylesheetFiles: unique(references.filter((reference) => reference.isStylesheet).map((reference) => reference.path), 80),
    components: unique(references.flatMap((reference) => reference.components), 80),
    visibleText: unique(references.flatMap((reference) => reference.visibleText), 180),
    layoutHierarchy: unique(
      references.flatMap((reference) => [
        ...reference.layout.roots.map((root) => `root:${root}`),
        ...reference.layout.tags.map((tag) => `tag:${tag}`),
        ...reference.layout.components.map((component) => `component:${component}`),
      ]),
      100,
    ),
    classes: unique(references.flatMap((reference) => reference.classes), 160),
    themeColors: unique(references.flatMap((reference) => reference.themeColors), 80),
    typography: unique(references.flatMap((reference) => reference.typography), 80),
    spacing: unique(references.flatMap((reference) => reference.spacing), 80),
    icons: unique(references.flatMap((reference) => reference.icons), 80),
    controls: unique(references.flatMap((reference) => reference.controls), 80),
    responsive: unique(references.flatMap((reference) => reference.responsive), 80),
  };
}

function formatList(values, emptyText = "Not detected in scanned UI source.") {
  if (!values?.length) {
    return `- ${emptyText}`;
  }

  return values.map((value) => `- ${value}`).join("\n");
}

function formatInline(values, limit = 26) {
  if (!values?.length) {
    return "Not detected in scanned UI source.";
  }

  const visibleValues = values.slice(0, limit);
  const suffix = values.length > limit ? `, plus ${values.length - limit} more` : "";
  return `${visibleValues.join(", ")}${suffix}`;
}

function formatStylingSystems(stylingSystem) {
  if (!stylingSystem?.systems?.length) {
    return "- Unknown styling system. Inspect package.json, build config, stylesheets, and template/component classes before frontend implementation.";
  }

  return stylingSystem.systems
    .map((system) => `- ${system.name}: ${system.evidence.join("; ")}`)
    .join("\n");
}

export function buildUiReference(chunks = [], analysis = null) {
  const references = chunks
    .filter((chunk) => chunk?.path && chunk?.content && isUiSourcePath(chunk.path))
    .map(extractFileReference);
  const merged = mergeReferences(references);
  const stylingSystem = buildStylingSystemReference(chunks, analysis, merged.classes);

  return {
    available: references.length > 0,
    stylingSystem,
    files: merged.files,
    stylesheetFiles: merged.stylesheetFiles,
    components: merged.components,
    visibleText: merged.visibleText,
    layoutHierarchy: merged.layoutHierarchy,
    classes: merged.classes,
    themeColors: merged.themeColors,
    typography: merged.typography,
    spacing: merged.spacing,
    icons: merged.icons,
    controls: merged.controls,
    responsive: merged.responsive,
    markdown: buildUiReferenceMarkdown(references, merged, stylingSystem),
  };
}

export function buildUiReferenceMarkdown(references, merged, stylingSystem = null) {
  if (references.length === 0) {
    return `## UI Reference Extracted from Original Code

- No UI, template, stylesheet, component, asset, or public files were detected in the scanned source.
- Styling system assessment: ${stylingSystem?.primary ?? "Unknown styling system"}.
- Before frontend implementation, create this inventory from the original repository and use it as the only visual source of truth.
- Until that inventory exists, the migration spec must not invent screens, layouts, styles, icons, colors, typography, spacing, or responsive behavior.`;
  }

  const fileSummaries = references
    .slice(0, 18)
    .map((reference) => {
      const details = [
        reference.components.length ? `components: ${reference.components.join(", ")}` : "",
        reference.layout.tags.length ? `layout tags: ${reference.layout.tags.join(", ")}` : "",
        reference.visibleText.length ? `visible text samples: ${reference.visibleText.slice(0, 4).join(" | ")}` : "",
        reference.controls.length ? `controls: ${reference.controls.join(", ")}` : "",
        reference.responsive.length ? `responsive: ${reference.responsive.slice(0, 8).join(", ")}` : "",
      ].filter(Boolean);

      return `- ${reference.path}${details.length ? ` (${details.join("; ")})` : ""}`;
    })
    .join("\n");

  return `## UI Reference Extracted from Original Code

This section is extracted from original UI source files and stylesheets. Treat it as the only UI source of truth; generated modernization guidance may reference it but must not invent replacement design.

### Source UI Files

${fileSummaries}

### Styling System Assessment

- Primary styling approach: ${stylingSystem?.primary ?? "Unknown styling system"}

Detected styling evidence:

${formatStylingSystems(stylingSystem)}

Migration rule: preserve the detected styling approach and original selectors/classes. Do not convert Tailwind, SCSS/Sass, Bootstrap, CSS Modules, CSS-in-JS, or plain CSS into a different styling system unless the migration explicitly requires a compatibility wrapper.

### CSS and Stylesheet Source Files

${formatList(merged.stylesheetFiles, "No standalone stylesheet files detected. Preserve inline styles, utility classes, CSS modules, or component-local styles from the source UI files.")}

CSS preservation rule: copy or translate these stylesheet files one-to-one. Preserve selectors, class names, CSS variables, media queries, color values, typography, spacing, border radii, shadows, asset references, and import order unless a target build tool requires a mechanical import-path change.

### Component Structure

${formatList(merged.components)}

### Visible UI Text

${formatList(merged.visibleText, "No visible UI strings were extracted. Before implementation, manually capture labels, headings, button text, placeholders, alt text, aria labels, loading text, empty states, and error messages from the source UI.")}

Text preservation rule: keep every visible string, label, placeholder, aria label, alt/title text, empty state, loading message, validation message, and button/link copy unchanged unless product owners approve a copy change.

### Layout Hierarchy

${formatList(merged.layoutHierarchy)}

### CSS, Tailwind, and Class Names

${formatInline(merged.classes, 60)}

### Theme Colors

${formatList(merged.themeColors)}

### Typography

${formatList(merged.typography)}

### Spacing and Sizing

${formatList(merged.spacing)}

### Icons and Visual Assets

${formatList(merged.icons, "No icon library, icon components, or icon-specific classes detected in scanned UI source. Preserve existing asset references manually if present.")}

### Button and Input Styles

${formatList(merged.controls)}

### Responsive Behavior

${formatList(merged.responsive)}
`;
}
