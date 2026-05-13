const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not configured.");
}

export async function generateSpecification(zipFile, modernizationTarget = {}) {
  const targetStack =
    typeof modernizationTarget === "string"
      ? modernizationTarget
      : modernizationTarget.targetStack ?? "React + Spring Boot";

  const formData = new FormData();
  formData.append("projectZip", zipFile);
  formData.append("targetStack", targetStack);

  if (typeof modernizationTarget === "object" && modernizationTarget !== null) {
    formData.append("frontendTargetVersion", modernizationTarget.frontendTargetVersion ?? "");
    formData.append("backendTargetVersion", modernizationTarget.backendTargetVersion ?? "");
  }

  const response = await fetch(`${API_BASE_URL}/spec/generate`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error ?? "Failed to generate specification.");
  }

  return response.json();
}

export function getDownloadUrl(downloadId) {
  return `${API_BASE_URL}/spec/download/${downloadId}`;
}
