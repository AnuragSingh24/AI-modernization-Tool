import { useRef, useState } from "react";

const targetStackOptions = [
  "React + Spring Boot",
  "React + Node.js + Express",
  "Next.js + Spring Boot",
  "Vue + Spring Boot",
];

const frontendTargetOptions = [
  "React 19.2.6",
  "React 18.3.1",
  "Next.js 16.x",
  "Vue 3.x",
];

const defaultBackendTargetOption = "Java 21 LTS + Spring Boot 3.5.x";

const backendTargetOptions = [
  "Node.js 24.x LTS + Express 5.2.1",
  "Node.js 22.x LTS + Express 5.2.1",
  "Java 26.0.1 + Spring Boot 3.5.x",
  defaultBackendTargetOption,
  "Java 17 LTS + Spring Boot 3.5.x",
];

export function UploadForm({ loading, onSubmit }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [targetStack, setTargetStack] = useState(targetStackOptions[0]);
  const [frontendTargetVersion, setFrontendTargetVersion] = useState(frontendTargetOptions[0]);
  const [backendTargetVersion, setBackendTargetVersion] = useState(defaultBackendTargetOption);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) return "Unknown size";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function acceptFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Only ZIP files are supported.");
      return;
    }

    setSelectedFile(file);
    setError("");
  }

  function clearSelection() {
    setSelectedFile(null);
    setError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Choose a ZIP file first.");
      return;
    }

    setError("");
    await onSubmit(selectedFile, {
      targetStack,
      frontendTargetVersion,
      backendTargetVersion,
    });
  }

  return (
    <form className="upload-panel" onSubmit={handleSubmit}>
      <div className="panel-heading compact">
        <div>
          <span className="section-kicker">Input</span>
          <h2>Project ZIP</h2>
        </div>
      </div>

      <label
        className={`dropzone ${dragActive ? "dropzone-active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          acceptFile(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <span className="file-glyph">ZIP</span>
        <strong>{selectedFile ? selectedFile.name : "Drop ZIP here"}</strong>
        <small>{selectedFile ? formatFileSize(selectedFile.size) : "or browse from your machine"}</small>
        <button
          className="secondary-button"
          type="button"
          onClick={(event) => {
            event.preventDefault();
            inputRef.current?.click();
          }}
        >
          Browse
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
        />
      </label>

      {selectedFile ? (
        <div className="selected-file">
          <div>
            <span>Selected</span>
            <strong>{selectedFile.name}</strong>
          </div>
          <button className="ghost-button" type="button" onClick={clearSelection}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="target-stack-card">
        <label htmlFor="targetStack">
          <span className="section-kicker">Target</span>
          <strong>Generate specs for</strong>
        </label>
        <select
          id="targetStack"
          value={targetStack}
          onChange={(event) => setTargetStack(event.target.value)}
          disabled={loading}
        >
          {targetStackOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="version-field-grid">
          <label htmlFor="frontendTargetVersion">
            <span>Frontend target</span>
            <select
              id="frontendTargetVersion"
              value={frontendTargetVersion}
              onChange={(event) => setFrontendTargetVersion(event.target.value)}
              disabled={loading}
            >
              {frontendTargetOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="backendTargetVersion">
            <span>Backend target</span>
            <select
              id="backendTargetVersion"
              value={backendTargetVersion}
              onChange={(event) => setBackendTargetVersion(event.target.value)}
              disabled={loading}
            >
              {backendTargetOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <small>Detected current versions appear after upload, then the spec is generated against these targets.</small>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Generating..." : "Generate spec"}
      </button>
    </form>
  );
}
