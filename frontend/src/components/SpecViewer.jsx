import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { getDownloadUrl } from "../services/api";

const tabs = [
  ["markdown", "Markdown"],
  ["assessment", "Assessment"],
  ["routes", "Routes"],
  ["dependencies", "Dependencies"],
  ["devDependencies", "Dev"],
];

function StackBadge({ active, label }) {
  return <span className={`stack-badge ${active ? "stack-badge-active" : ""}`}>{label}</span>;
}

export function SpecViewer({ result, onReset }) {
  const [activeTab, setActiveTab] = useState("markdown");
  const [copied, setCopied] = useState(false);

  const dependencyItems = useMemo(
    () =>
      result.analysis.packageJsons.flatMap((pkg) =>
        Object.entries(pkg.dependencies ?? {}).map(([name, version]) => ({
          name,
          version,
          scope: pkg.name ?? "package",
        })),
      ),
    [result.analysis.packageJsons],
  );

  const devDependencyItems = useMemo(
    () =>
      result.analysis.packageJsons.flatMap((pkg) =>
        Object.entries(pkg.devDependencies ?? {}).map(([name, version]) => ({
          name,
          version,
          scope: pkg.name ?? "package",
        })),
      ),
    [result.analysis.packageJsons],
  );

  async function handleCopyMarkdown() {
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="workspace-panel spec-viewer">
      <div className="result-toolbar">
        <div>
          <span className="section-kicker">Output</span>
          <h2>{result.analysis.projectName}</h2>
          <p className="target-copy">
            Migration target: <strong>{result.targetStack ?? "React + Spring Boot"}</strong>
          </p>
          {result.versionAssessment ? (
            <p className="target-copy">
              Frontend: <strong>{result.versionAssessment.frontend.targetVersion}</strong> |
              Backend: <strong>{result.versionAssessment.backend.targetVersion}</strong>
            </p>
          ) : null}
          <div className="stack-row">
            <StackBadge active={result.analysis.stack.hasReact} label="React" />
            <StackBadge active={result.analysis.stack.hasNode} label="Node" />
            <StackBadge active={result.analysis.stack.hasExpress} label="Express" />
            <StackBadge active={result.analysis.stack.hasJava} label="Java" />
            <StackBadge active={result.analysis.stack.hasSpringBoot} label="Spring Boot" />
          </div>
        </div>

        <div className="action-row">
          <a className="primary-button" href={getDownloadUrl(result.downloadId)}>
            Download pack
          </a>
          <button className="secondary-button" type="button" onClick={handleCopyMarkdown}>
            {copied ? "Copied" : "Copy"}
          </button>
          {onReset ? (
            <button className="ghost-button" type="button" onClick={onReset}>
              New ZIP
            </button>
          ) : null}
        </div>
      </div>

      <div className="metric-grid">
        <div>
          <span>Files</span>
          <strong>{result.analysis.summary.fileCount}</strong>
        </div>
        <div>
          <span>Packages</span>
          <strong>{result.analysis.summary.packageJsonCount}</strong>
        </div>
        <div>
          <span>Routes</span>
          <strong>{result.analysis.apiRoutes.length}</strong>
        </div>
        <div>
          <span>Context</span>
          <strong>{result.retrievedChunkCount ?? 0}</strong>
        </div>
        <div>
          <span>Spec files</span>
          <strong>{result.specFileCount ?? 1}</strong>
        </div>
        <div>
          <span>RAG</span>
          <strong>{result.ragMode === "chroma" ? "ChromaDB" : "Local"}</strong>
        </div>
      </div>

      {result.versionAssessment ? (
        <div className="version-assessment-grid">
          {result.stylingAssessment ? <StylingAssessmentCard item={result.stylingAssessment} /> : null}
          <VersionAssessmentCard title="Frontend" item={result.versionAssessment.frontend} />
          <VersionAssessmentCard title="Backend" item={result.versionAssessment.backend} />
        </div>
      ) : null}

      <div className="tabs" role="tablist" aria-label="Spec views">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? "tab-active" : ""}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "markdown" ? (
        <article className="markdown-panel">
          <ReactMarkdown>{result.markdown}</ReactMarkdown>
        </article>
      ) : null}

      {activeTab === "assessment" ? (
        <div className="data-list">
          {result.versionAssessment ? (
            <>
              {result.stylingAssessment ? <StylingAssessmentRow item={result.stylingAssessment} /> : null}
              <VersionAssessmentRow title="Frontend" item={result.versionAssessment.frontend} />
              <VersionAssessmentRow title="Backend" item={result.versionAssessment.backend} />
              <VersionAssessmentRow title="Runtime" item={result.versionAssessment.runtime} />
            </>
          ) : (
            <p className="muted-text">No version assessment returned.</p>
          )}
        </div>
      ) : null}

      {activeTab === "routes" ? (
        <div className="data-list">
          {result.analysis.apiRoutes.length ? (
            result.analysis.apiRoutes.map((route) => (
              <div className="data-row" key={`${route.method}-${route.path}-${route.filePath}`}>
                <span className="method-pill">{route.method}</span>
                <strong>{route.path}</strong>
                <small>{route.filePath}</small>
              </div>
            ))
          ) : (
            <p className="muted-text">No Express or Spring routes detected.</p>
          )}
        </div>
      ) : null}

      {activeTab === "dependencies" ? (
        <DependencyList items={dependencyItems} emptyText="No runtime dependencies detected." />
      ) : null}

      {activeTab === "devDependencies" ? (
        <DependencyList items={devDependencyItems} emptyText="No dev dependencies detected." />
      ) : null}
    </section>
  );
}

function StylingAssessmentCard({ item }) {
  return (
    <div className="version-card">
      <span>Styling method</span>
      <strong>{item?.primary ?? "Unknown"}</strong>
      <small>Current project UI styling</small>
    </div>
  );
}

function VersionAssessmentCard({ title, item }) {
  return (
    <div className="version-card">
      <span>{title}</span>
      <strong>{item?.currentVersion ?? "Unknown current"}</strong>
      <small>Target: {item?.targetVersion ?? "Not selected"}</small>
    </div>
  );
}

function StylingAssessmentRow({ item }) {
  const evidence = item?.systems?.flatMap((system) => system.evidence ?? []) ?? [];

  return (
    <div className="version-row">
      <div>
        <span>Styling method</span>
        <strong>{item?.primary ?? "Unknown"}</strong>
      </div>
      <div>
        <span>Current</span>
        <strong>{item?.systems?.map((system) => system.name).join(", ") || "Unknown"}</strong>
      </div>
      <div>
        <span>Evidence</span>
        <strong>{evidence[0] ?? "Not detected"}</strong>
      </div>
    </div>
  );
}

function VersionAssessmentRow({ title, item }) {
  return (
    <div className="version-row">
      <div>
        <span>{title}</span>
        <strong>{item?.name ?? "Unknown"}</strong>
      </div>
      <div>
        <span>Current</span>
        <strong>{item?.currentVersion ?? "Unknown"}</strong>
      </div>
      <div>
        <span>Target</span>
        <strong>{item?.targetVersion ?? "Not selected"}</strong>
      </div>
    </div>
  );
}

function DependencyList({ items, emptyText }) {
  if (!items.length) {
    return <p className="muted-text">{emptyText}</p>;
  }

  return (
    <div className="dependency-grid">
      {items.map((item) => (
        <div className="dependency-item" key={`${item.scope}-${item.name}`}>
          <strong>{item.name}</strong>
          <span>{item.version}</span>
          <small>{item.scope}</small>
        </div>
      ))}
    </div>
  );
}
