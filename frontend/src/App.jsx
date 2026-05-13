import { useState } from "react";
import { SpecViewer } from "./components/SpecViewer";
import { UploadForm } from "./components/UploadForm";
import { generateSpecification } from "./services/api";

const scanSteps = ["Upload", "Extract", "Assess", "Retrieve", "Generate"];

function ProcessingPanel() {
  return (
    <section className="workspace-panel processing-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Running</span>
          <h2>Generating modernization spec</h2>
        </div>
        <span className="status-pill status-pill-live">Processing</span>
      </div>

      <div className="scan-line" />

      <div className="step-list">
        {scanSteps.map((step, index) => (
          <div className="step-row" key={step}>
            <span className="step-index">{index + 1}</span>
            <span>{step}</span>
            <div className="step-bar">
              <div className="step-bar-fill" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="workspace-panel empty-state">
      <div>
        <span className="section-kicker">Output</span>
        <h2>Upload a ZIP to generate the spec</h2>
        <p>
          The review area will show current versions, selected target versions, generated markdown,
          detected routes, dependencies, and export actions after analysis completes.
        </p>
      </div>

      <div className="empty-grid">
        <div>
          <span>Assessment</span>
          <strong>Current and target versions</strong>
        </div>
        <div>
          <span>Context</span>
          <strong>ChromaDB or local RAG</strong>
        </div>
        <div>
          <span>Export</span>
          <strong>modernization-spec.md</strong>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleUpload(file, modernizationTarget) {
    setLoading(true);
    setError("");

    try {
      const response = await generateSpecification(file, modernizationTarget);
      setResult(response);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError("");
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="section-kicker">AI Modernization Tool</span>
          <h1>Specification Studio</h1>
        </div>
        <div className="header-status">
          <span className="status-dot" />
          <span>{loading ? "Analyzing" : result ? "Ready to export" : "Ready"}</span>
        </div>
      </header>

      <section className="app-layout">
        <aside className="control-rail">
          <UploadForm loading={loading} onSubmit={handleUpload} />

          {error ? (
            <div className="error-panel">
              <strong>Request failed</strong>
              <p>{error}</p>
            </div>
          ) : null}

          <div className="mini-panel">
            <span className="section-kicker">Pipeline</span>
            <ol className="pipeline-list">
              {scanSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </aside>

        <div className="workbench">
          {loading ? (
            <ProcessingPanel />
          ) : result ? (
            <SpecViewer result={result} onReset={handleReset} />
          ) : (
            <EmptyState />
          )}
        </div>
      </section>
    </main>
  );
}
