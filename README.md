# AI Modernization Tool MVP

Minimal MVP that accepts a ZIP project, extracts technical context, stores lightweight file chunks on disk, retrieves relevant context, sends that context to OpenAI, and generates a modernization specification in markdown.

## Stack

- Frontend: React + Vite + TailwindCSS + JavaScript
- Backend: Node.js + Express + JavaScript
- AI/RAG: OpenAI for generation, OpenAI embeddings, ChromaDB vector retrieval, and local keyword fallback when vector services are unavailable

## Architecture

- Upload ZIP project to the Express backend
- Extract the ZIP to a temporary workspace
- Detect React, Node.js, Express, Java, and Spring Boot details from source, `package.json`, Maven, and Gradle files
- Parse Express APIs, Spring controller APIs, and dependencies
- Build and store lightweight local context chunks
- Retrieve relevant context with ChromaDB vector RAG when available, or local keyword scoring as a fallback
- Send summary context plus retrieved context to OpenAI
- Save and display `modernization-spec.md`

## Run

1. Install dependencies:

```bash
npm install
```

2. Create [.env](.env) in the project root with:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
CHROMA_HOST=api.trychroma.com
CHROMA_PORT=
CHROMA_SSL=false
CHROMA_API_KEY=your_chroma_key_here
CHROMA_TENANT=your_chroma_tenant
CHROMA_DATABASE=modernization_specs
CHROMA_COLLECTION_NAME=project_contexts
RAG_TOP_K=8
MAX_RAG_FILES=30
MAX_FILE_CHARS=8000
CHUNK_SIZE=1600
CHUNK_OVERLAP=200
VITE_API_BASE_URL=http://localhost:4000/api
```

3. Start backend:

```bash
npm run dev:backend
```

4. Start frontend:

```bash
npm run dev:frontend
```

## Notes

- The backend does not require Postgres or pgvector.
- Lightweight RAG context is stored locally under `tmp/knowledge` as JSON files.
- The generated spec is based on ZIP extraction, dependency parsing, Express/Spring route extraction, stored context chunks, and retrieved context sent to OpenAI.
- If OpenAI embeddings or ChromaDB are unavailable, the app falls back to local keyword RAG instead of failing the request.
- If `OPENAI_API_KEY` is missing, the app falls back to a locally generated markdown spec.

## Accuracy Report
[Project_Review_Report.pdf](https://github.com/user-attachments/files/27755445/Project_Review_Report.pdf)

