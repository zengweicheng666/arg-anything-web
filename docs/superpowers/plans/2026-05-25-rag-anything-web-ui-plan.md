# RAG-Anything Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone web UI for RAG-Anything with a chat-first interface and expandable management panels.

**Architecture:** FastAPI backend wraps RAGAnything operations (file management, pipeline orchestration, streaming query). React + Vite frontend provides a three-column layout with Simple/Advanced mode toggle. WebSocket handles real-time pipeline progress and streaming query responses.

**Tech Stack:** FastAPI + Uvicorn, React 18 + Vite + TypeScript, Tailwind CSS + shadcn/ui, Zustand, React Flow

**Location:** `/Users/linping-mac/RAG-Anything-Web`

---

## File Structure

```
/Users/linping-mac/RAG-Anything-Web/
├── pyproject.toml                    # Backend dependencies
├── backend/
│   ├── __init__.py                   # Package marker
│   ├── __main__.py                   # CLI entry: python -m backend
│   ├── app.py                        # FastAPI app + routes + WebSocket
│   ├── models.py                     # Pydantic models
│   └── pipeline_manager.py           # Pipeline orchestration
├── webui/                            # Frontend (Vite + React)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── lib/
│       │   └── api.ts                # REST API client
│       ├── store/
│       │   ├── pipeline.ts
│       │   ├── documents.ts
│       │   └── config.ts
│       ├── hooks/
│       │   ├── useWebSocket.ts
│       │   └── usePipeline.ts
│       └── components/
│           ├── Layout.tsx
│           ├── Sidebar.tsx
│           ├── FolderTree.tsx
│           ├── FileList.tsx
│           ├── Chat.tsx
│           ├── ChatMessage.tsx
│           ├── ChatInput.tsx
│           ├── PipelinePanel.tsx
│           ├── GraphView.tsx
│           ├── ConfigPanel.tsx
│           ├── StatusBar.tsx
│           └── ModeToggle.tsx
└── docs/
    ├── specs/
    │   └── 2026-05-25-rag-anything-web-ui-design.md
    └── plans/
        └── 2026-05-25-rag-anything-web-ui-plan.md
```

---

### Task 1: Backend scaffolding

**Files:**
- Create: `backend/__init__.py`
- Create: `backend/__main__.py`
- Create: `pyproject.toml`

- [ ] **Step 1: Create pyproject.toml**

```toml
# /Users/linping-mac/RAG-Anything-Web/pyproject.toml
[project]
name = "raganything-webui"
version = "0.1.0"
description = "Web UI for RAG-Anything"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "raganything",
]
```

- [ ] **Step 2: Create backend package init**

```python
# /Users/linping-mac/RAG-Anything-Web/backend/__init__.py
"""Web UI backend for RAG-Anything."""
```

- [ ] **Step 3: Create CLI entry point**

```python
# /Users/linping-mac/RAG-Anything-Web/backend/__main__.py
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.app:app",
        host="127.0.0.1",
        port=8765,
        reload=False,
    )
```

- [ ] **Step 4: Install dependencies**

Run: `cd /Users/linping-mac/RAG-Anything-Web && python3 -m venv .venv && source .venv/bin/activate && pip install -e .`

- [ ] **Step 5: Verify import works**

Run: `cd /Users/linping-mac/RAG-Anything-Web && source .venv/bin/activate && python -c "import backend; print('OK')"`
Expected: `OK`

---

### Task 2: Pydantic models

**Files:**
- Create: `backend/models.py`

- [ ] **Step 1: Create models**

```python
# /Users/linping-mac/RAG-Anything-Web/backend/models.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class Document(BaseModel):
    path: str
    name: str
    size: int
    type: str  # pdf, jpg, png, docx, etc.
    status: str = "pending"  # pending, parsing, indexing, ready, failed
    progress: float = 0.0
    error: Optional[str] = None


class PipelineEvent(BaseModel):
    event: str = "stage_update"
    stage: str  # scanning, parsing, multimodal, graph, complete
    file: Optional[str] = None
    progress: float = 0.0
    status: str = "processing"
    message: Optional[str] = None


class QueryRequest(BaseModel):
    query: str
    mode: str = "mix"
    system_prompt: Optional[str] = None


class MultimodalQueryRequest(BaseModel):
    query: str
    multimodal_content: List[Dict[str, Any]] = Field(default_factory=list)
    mode: str = "mix"


class FolderItem(BaseModel):
    name: str
    path: str
    type: str = "folder"  # folder, file


class FolderSelectRequest(BaseModel):
    path: str


class ConfigUpdate(BaseModel):
    working_dir: Optional[str] = None
    parser: Optional[str] = None
    parse_method: Optional[str] = None
    llm_model: Optional[str] = None
    embedding_model: Optional[str] = None
    enable_image_processing: Optional[bool] = None
    enable_table_processing: Optional[bool] = None
    enable_equation_processing: Optional[bool] = None


class GraphNode(BaseModel):
    id: str
    label: str
    type: str = "entity"


class GraphEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None
```

- [ ] **Step 2: Verify models import**

Run: `cd /Users/linping-mac/RAG-Anything-Web && source .venv/bin/activate && python -c "from backend.models import Document, PipelineEvent; print('OK')"`
Expected: `OK`

---

### Task 3: Pipeline Manager

**Files:**
- Create: `backend/pipeline_manager.py`

- [ ] **Step 1: Create pipeline manager**

```python
# /Users/linping-mac/RAG-Anything-Web/backend/pipeline_manager.py
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from lightrag.utils import logger
from raganything import RAGAnything


class PipelineManager:
    """Orchestrates document indexing pipeline with real-time progress events."""

    def __init__(self, rag: RAGAnything):
        self.rag = rag
        self._running = False
        self._progress_callbacks: List[Callable] = []
        self._current_stage: str = "idle"
        self._documents: List[Dict[str, Any]] = []

    def on_progress(self, callback: Callable) -> None:
        self._progress_callbacks.append(callback)

    async def _emit(self, **kwargs) -> None:
        msg = {
            "event": "stage_update",
            **kwargs,
        }
        for cb in self._progress_callbacks:
            if asyncio.iscoroutinefunction(cb):
                await cb(msg)
            else:
                cb(msg)

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def documents(self) -> List[Dict[str, Any]]:
        return self._documents

    async def scan_folder(self, folder_path: str) -> List[Dict[str, Any]]:
        """Scan folder for supported documents."""
        supported_extensions = {
            ".pdf", ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif",
            ".gif", ".webp", ".doc", ".docx", ".ppt", ".pptx",
            ".xls", ".xlsx", ".txt", ".md",
        }

        docs = []
        for f in Path(folder_path).rglob("*"):
            if f.suffix.lower() in supported_extensions and f.is_file():
                docs.append({
                    "path": str(f),
                    "name": f.name,
                    "size": f.stat().st_size,
                    "type": f.suffix[1:].lower(),
                    "status": "pending",
                    "progress": 0.0,
                    "error": None,
                })

        docs.sort(key=lambda d: d["name"])
        self._documents = docs
        return docs

    async def run_pipeline(self, folder_path: str) -> None:
        """Run full indexing pipeline."""
        if self._running:
            raise RuntimeError("Pipeline already running")

        self._running = True
        self._current_stage = "scanning"

        try:
            await self._emit(stage="scanning", progress=0.0, message="Scanning folder...")

            docs = await self.scan_folder(folder_path)
            if not docs:
                await self._emit(stage="scanning", progress=1.0, status="done",
                                 message="No documents found")
                self._running = False
                self._current_stage = "complete"
                return

            await self._emit(stage="scanning", progress=1.0, status="done",
                             message=f"Found {len(docs)} documents")

            init_result = await self.rag._ensure_lightrag_initialized()
            if not init_result or not init_result.get("success"):
                raise RuntimeError(init_result.get("error", "LightRAG init failed"))

            total = len(docs)
            for i, doc in enumerate(docs):
                file_path = doc["path"]
                file_name = doc["name"]
                self._documents[i]["status"] = "parsing"

                await self._emit(stage="parsing", file=file_name,
                                 progress=(i / total),
                                 message=f"Processing {file_name} ({i + 1}/{total})")

                try:
                    await self.rag.process_document_complete(
                        file_path,
                        output_dir=self.rag.config.parser_output_dir,
                        parse_method=self.rag.config.parse_method,
                    )
                    self._documents[i]["status"] = "ready"
                except Exception as exc:
                    self._documents[i]["status"] = "failed"
                    self._documents[i]["error"] = str(exc)
                    logger.error(f"Failed to process {file_name}: {exc}")

            await self._emit(stage="complete", progress=1.0, status="done",
                             message="Indexing complete")
            self._current_stage = "complete"

        except Exception as exc:
            await self._emit(stage="error", status="failed", message=str(exc))
            self._current_stage = "error"
        finally:
            self._running = False

    def get_status(self) -> Dict[str, Any]:
        ready = sum(1 for d in self._documents if d["status"] == "ready")
        failed = sum(1 for d in self._documents if d["status"] == "failed")
        return {
            "stage": self._current_stage,
            "running": self._running,
            "total": len(self._documents),
            "ready": ready,
            "failed": failed,
            "documents": self._documents,
        }
```

- [ ] **Step 2: Verify imports**

Run: `cd /Users/linping-mac/RAG-Anything-Web && source .venv/bin/activate && python -c "from backend.pipeline_manager import PipelineManager; print('OK')"`
Expected: `OK`

---

### Task 4: FastAPI application + routes + WebSocket

**Files:**
- Create: `backend/app.py`

- [ ] **Step 1: Create FastAPI app**

```python
# /Users/linping-mac/RAG-Anything-Web/backend/app.py
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from lightrag.utils import logger
from raganything import RAGAnything

from backend.models import (
    ConfigUpdate,
    FolderItem,
    FolderSelectRequest,
    GraphEdge,
    GraphNode,
    MultimodalQueryRequest,
    QueryRequest,
)
from backend.pipeline_manager import PipelineManager

app = FastAPI(title="RAG-Anything Web UI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Global state ----
_rag: Optional[RAGAnything] = None
_pipeline: Optional[PipelineManager] = None
_ws_clients: List[WebSocket] = []


def _ensure_rag() -> RAGAnything:
    global _rag
    if _rag is None:
        _rag = RAGAnything()
    return _rag


def _ensure_pipeline() -> PipelineManager:
    global _pipeline, _rag
    rag = _ensure_rag()
    if _pipeline is None:
        _pipeline = PipelineManager(rag)
    return _pipeline


# ---- Folder / File endpoints ----

@app.get("/api/folders/list")
async def list_folders(path: str = "~") -> List[FolderItem]:
    """List directory contents. Defaults to home directory."""
    try:
        base = Path(path).expanduser().resolve()
        if not base.exists() or not base.is_dir():
            raise HTTPException(status_code=404, detail=f"Directory not found: {path}")
        if not str(base).startswith("/"):
            raise HTTPException(status_code=403, detail="Path traversal denied")
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    items = []
    try:
        for entry in sorted(base.iterdir(), key=lambda e: (not e.is_dir(), e.name)):
            items.append(FolderItem(
                name=entry.name,
                path=str(entry),
                type="folder" if entry.is_dir() else "file",
            ))
    except PermissionError:
        pass
    return items


@app.post("/api/folders/select")
async def select_folder(req: FolderSelectRequest) -> Dict[str, Any]:
    """Set working folder and scan documents."""
    path = Path(req.path).expanduser().resolve()
    if not path.exists() or not path.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")

    rag = _ensure_rag()
    rag.config.working_dir = str(path / ".rag_storage")
    pipeline = _ensure_pipeline()
    docs = await pipeline.scan_folder(str(path))
    return {"folder": str(path), "documents": docs, "document_count": len(docs)}


@app.get("/api/documents")
async def list_documents() -> List[Dict[str, Any]]:
    pipeline = _ensure_pipeline()
    return pipeline.documents


# ---- Pipeline endpoints ----

@app.post("/api/pipeline/start")
async def start_pipeline() -> Dict[str, Any]:
    pipeline = _ensure_pipeline()
    rag = _ensure_rag()
    if pipeline.is_running:
        raise HTTPException(status_code=409, detail="Pipeline already running")

    working_dir = rag.config.working_dir
    folder_path = str(Path(working_dir).parent) if working_dir else None
    if not folder_path or not Path(folder_path).exists():
        raise HTTPException(status_code=400, detail="No folder selected. Call /api/folders/select first.")

    import asyncio
    asyncio.create_task(pipeline.run_pipeline(folder_path))
    return {"status": "started"}


@app.get("/api/pipeline/status")
async def get_pipeline_status() -> Dict[str, Any]:
    pipeline = _ensure_pipeline()
    return pipeline.get_status()


# ---- Query endpoints ----

@app.post("/api/query")
async def query_text(req: QueryRequest):
    """Streaming text query via SSE."""
    rag = _ensure_rag()

    async def generate():
        try:
            response = await rag.aquery(req.query, mode=req.mode, system_prompt=req.system_prompt)
            yield f"data: {json.dumps({'type': 'token', 'content': response})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/api/query/multimodal")
async def query_multimodal(req: MultimodalQueryRequest):
    """Streaming multimodal query via SSE."""
    rag = _ensure_rag()

    async def generate():
        try:
            response = await rag.aquery_with_multimodal(
                req.query,
                multimodal_content=req.multimodal_content,
                mode=req.mode,
            )
            yield f"data: {json.dumps({'type': 'token', 'content': response})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ---- Config endpoints ----

@app.get("/api/config")
async def get_config() -> Dict[str, Any]:
    rag = _ensure_rag()
    return rag.get_config_info()


@app.put("/api/config")
async def update_config(update: ConfigUpdate) -> Dict[str, Any]:
    rag = _ensure_rag()
    if update.working_dir is not None:
        rag.config.working_dir = update.working_dir
    if update.parser is not None:
        rag.config.parser = update.parser
    if update.parse_method is not None:
        rag.config.parse_method = update.parse_method
    if update.enable_image_processing is not None:
        rag.config.enable_image_processing = update.enable_image_processing
    if update.enable_table_processing is not None:
        rag.config.enable_table_processing = update.enable_table_processing
    if update.enable_equation_processing is not None:
        rag.config.enable_equation_processing = update.enable_equation_processing
    return {"status": "updated", "config": rag.get_config_info()}


# ---- Graph endpoints ----

@app.get("/api/graph/nodes")
async def get_graph_nodes() -> Dict[str, Any]:
    rag = _ensure_rag()
    if rag.lightrag is None:
        return {"nodes": [], "edges": []}
    try:
        from lightrag.kg.shared_storage import get_all_nodes, get_all_edges
        nodes = await get_all_nodes()
        edges = await get_all_edges()
        return {
            "nodes": [{"id": n["id"], "label": n.get("label", n["id"])} for n in nodes],
            "edges": [{"source": e["source"], "target": e["target"], "label": e.get("label")} for e in edges],
        }
    except Exception as exc:
        logger.warning(f"Failed to fetch graph: {exc}")
        return {"nodes": [], "edges": []}
```

- [ ] **Step 2: Add WebSocket handlers**

Append to `backend/app.py`:

```python
# ---- WebSocket endpoints ----

@app.websocket("/ws/pipeline")
async def websocket_pipeline(ws: WebSocket):
    await ws.accept()
    _ws_clients.append(ws)
    pipeline = _ensure_pipeline()

    async def send_event(msg: Dict[str, Any]):
        try:
            await ws.send_json(msg)
        except Exception:
            pass

    pipeline.on_progress(send_event)
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_json({"event": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        if ws in _ws_clients:
            _ws_clients.remove(ws)


@app.websocket("/ws/query")
async def websocket_query(ws: WebSocket):
    await ws.accept()
    rag = _ensure_rag()
    try:
        while True:
            data = await ws.receive_text()
            req = json.loads(data)
            query = req.get("query", "")
            mode = req.get("mode", "mix")

            try:
                response = await rag.aquery(query, mode=mode)
                await ws.send_json({"type": "token", "content": response})
                await ws.send_json({"type": "done"})
            except Exception as exc:
                await ws.send_json({"type": "error", "content": str(exc)})
    except WebSocketDisconnect:
        pass
```

- [ ] **Step 3: Verify app loads**

Run: `cd /Users/linping-mac/RAG-Anything-Web && source .venv/bin/activate && python -c "from backend.app import app; print('FastAPI app loaded:', app.title)"`
Expected: `FastAPI app loaded: RAG-Anything Web UI`

---

### Task 5: Frontend scaffolding

**Files:**
- Create: `webui/package.json`
- Create: `webui/index.html`
- Create: `webui/vite.config.ts`
- Create: `webui/tsconfig.json`
- Create: `webui/tsconfig.node.json`
- Create: `webui/tailwind.config.js`
- Create: `webui/postcss.config.js`
- Create: `webui/src/main.tsx`
- Create: `webui/src/index.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "raganything-webui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RAG-Anything</title>
</head>
<body class="bg-gray-950 text-gray-100">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8765',
      '/ws': {
        target: 'ws://127.0.0.1:8765',
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 7: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 8: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 3px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.streaming-cursor::after {
  content: '▊';
  animation: blink 1s step-end infinite;
  color: #60a5fa;
}
```

- [ ] **Step 9: Create src/main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 10: Install frontend deps**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npm install`

- [ ] **Step 11: Verify build**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx vite build 2>&1 | tail -5`
Expected: Build succeeds

---

### Task 6: Zustand stores

**Files:**
- Create: `webui/src/store/documents.ts`
- Create: `webui/src/store/pipeline.ts`
- Create: `webui/src/store/config.ts`

- [ ] **Step 1: Create documents store**

```typescript
// webui/src/store/documents.ts
import { create } from 'zustand'

export interface Document {
  path: string
  name: string
  size: number
  type: string
  status: 'pending' | 'parsing' | 'indexing' | 'ready' | 'failed'
  progress: number
  error?: string
}

interface DocumentsState {
  folder: string | null
  documents: Document[]
  setFolder: (path: string) => void
  setDocuments: (docs: Document[]) => void
  updateDocument: (path: string, updates: Partial<Document>) => void
  clear: () => void
}

export const useDocumentsStore = create<DocumentsState>((set) => ({
  folder: null,
  documents: [],
  setFolder: (path) => set({ folder: path }),
  setDocuments: (documents) => set({ documents }),
  updateDocument: (path, updates) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.path === path ? { ...d, ...updates } : d
      ),
    })),
  clear: () => set({ folder: null, documents: [] }),
}))
```

- [ ] **Step 2: Create pipeline store**

```typescript
// webui/src/store/pipeline.ts
import { create } from 'zustand'

export interface PipelineState {
  stage: string
  running: boolean
  total: number
  ready: number
  failed: number
  message: string | null
}

interface PipelineStore {
  status: PipelineState
  setStatus: (updates: Partial<PipelineState>) => void
  reset: () => void
}

const defaultStatus: PipelineState = {
  stage: 'idle',
  running: false,
  total: 0,
  ready: 0,
  failed: 0,
  message: null,
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  status: { ...defaultStatus },
  setStatus: (updates) =>
    set((state) => ({ status: { ...state.status, ...updates } })),
  reset: () => set({ status: { ...defaultStatus } }),
}))
```

- [ ] **Step 3: Create config store**

```typescript
// webui/src/store/config.ts
import { create } from 'zustand'

interface RagConfig {
  working_dir?: string
  parser?: string
  parse_method?: string
  llm_model_func?: string | null
  embedding_func?: string | null
  enable_image_processing?: boolean
  enable_table_processing?: boolean
  enable_equation_processing?: boolean
}

interface ConfigStore {
  config: RagConfig | null
  advancedMode: boolean
  setConfig: (config: RagConfig) => void
  setAdvancedMode: (on: boolean) => void
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,
  advancedMode: false,
  setConfig: (config) => set({ config }),
  setAdvancedMode: (advancedMode) => set({ advancedMode }),
}))
```

- [ ] **Step 4: Verify TypeScript**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 7: API client library

**Files:**
- Create: `webui/src/lib/api.ts`

- [ ] **Step 1: Create API client**

```typescript
// webui/src/lib/api.ts
import type { Document } from '../store/documents'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export interface FolderItem {
  name: string
  path: string
  type: 'folder' | 'file'
}

export const api = {
  folders: {
    list: (path = '~') =>
      get<FolderItem[]>(`/folders/list?path=${encodeURIComponent(path)}`),
    select: (path: string) =>
      post<{ folder: string; documents: Document[]; document_count: number }>(
        '/folders/select', { path }
      ),
  },
  documents: {
    list: () => get<Document[]>('/documents'),
  },
  pipeline: {
    start: () => post<{ status: string }>('/pipeline/start'),
    status: () =>
      get<{
        stage: string
        running: boolean
        total: number
        ready: number
        failed: number
        documents: Document[]
      }>('/pipeline/status'),
  },
  config: {
    get: () => get<Record<string, unknown>>('/config'),
    update: (cfg: Record<string, unknown>) => put('/config', cfg),
  },
  graph: {
    nodes: () => get<{ nodes: unknown[]; edges: unknown[] }>('/graph/nodes'),
  },
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 8: WebSocket hooks

**Files:**
- Create: `webui/src/hooks/useWebSocket.ts`
- Create: `webui/src/hooks/usePipeline.ts`

- [ ] **Step 1: Create WebSocket hook**

```typescript
// webui/src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react'

type MessageHandler = (data: unknown) => void

export function useWebSocket(url: string, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}${url}`)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current(data)
      } catch { /* ignore */ }
    }

    ws.onclose = () => {
      setTimeout(connect, 3000)
    }

    wsRef.current = ws
  }, [url])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
```

- [ ] **Step 2: Create pipeline hook**

```typescript
// webui/src/hooks/usePipeline.ts
import { useCallback } from 'react'
import { usePipelineStore } from '../store/pipeline'
import { useDocumentsStore } from '../store/documents'
import { useWebSocket } from './useWebSocket'
import { api } from '../lib/api'

export function usePipeline() {
  const setStatus = usePipelineStore((s) => s.setStatus)
  const updateDocument = useDocumentsStore((s) => s.updateDocument)

  const handleEvent = useCallback(
    (data: any) => {
      if (!data || !data.event) return
      if (data.event === 'stage_update') {
        setStatus({
          stage: data.stage,
          message: data.message || null,
        })
        if (data.stage === 'complete') {
          setStatus({ running: false })
        }
      }
      if (data.file && data.status) {
        const docStatus =
          data.status === 'done' ? 'ready'
          : data.status === 'failed' ? 'failed'
          : data.status === 'processing' ? 'parsing'
          : 'pending'
        updateDocument(data.file, { status: docStatus as any })
      }
    },
    [setStatus, updateDocument]
  )

  useWebSocket('/ws/pipeline', handleEvent)

  const start = useCallback(async () => {
    setStatus({ running: true, stage: 'starting', message: 'Starting...' })
    await api.pipeline.start()
    const status = await api.pipeline.status()
    setStatus({ total: status.total, ready: status.ready, failed: status.failed })
  }, [setStatus])

  const refresh = useCallback(async () => {
    const status = await api.pipeline.status()
    setStatus({
      stage: status.stage,
      running: status.running,
      total: status.total,
      ready: status.ready,
      failed: status.failed,
    })
  }, [setStatus])

  return { start, refresh }
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 9: Layout + mode toggle components

**Files:**
- Create: `webui/src/components/Layout.tsx`
- Create: `webui/src/components/ModeToggle.tsx`
- Create: `webui/src/components/StatusBar.tsx`
- Create: `webui/src/components/Sidebar.tsx`

- [ ] **Step 1: Create ModeToggle**

```typescript
// webui/src/components/ModeToggle.tsx
import { useConfigStore } from '../store/config'

export function ModeToggle() {
  const advancedMode = useConfigStore((s) => s.advancedMode)
  const setAdvancedMode = useConfigStore((s) => s.setAdvancedMode)

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${!advancedMode ? 'text-blue-400' : 'text-gray-500'}`}>
        Simple
      </span>
      <button
        onClick={() => setAdvancedMode(!advancedMode)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          advancedMode ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            advancedMode ? 'translate-x-[18px]' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`text-xs ${advancedMode ? 'text-blue-400' : 'text-gray-500'}`}>
        Advanced
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Create StatusBar**

```typescript
// webui/src/components/StatusBar.tsx
import { usePipelineStore } from '../store/pipeline'
import { useDocumentsStore } from '../store/documents'
import { useConfigStore } from '../store/config'

export function StatusBar() {
  const status = usePipelineStore((s) => s.status)
  const docs = useDocumentsStore((s) => s.documents)
  const config = useConfigStore((s) => s.config)

  return (
    <div className="flex items-center justify-between border-t border-gray-800 bg-gray-900 px-4 py-1 text-xs text-gray-500">
      <div className="flex items-center gap-4">
        <span>Stage: <span className="text-gray-300">{status.stage}</span></span>
        <span>Docs: <span className="text-gray-300">{docs.length}</span></span>
        {status.ready > 0 && (
          <span>Indexed: <span className="text-green-400">{status.ready}</span></span>
        )}
        {status.failed > 0 && (
          <span>Failed: <span className="text-red-400">{status.failed}</span></span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {status.running && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            Processing...
          </span>
        )}
        <span>LLM: {config?.llm_model_func || 'not set'}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Layout**

```typescript
// webui/src/components/Layout.tsx
import type { ReactNode } from 'react'
import { ModeToggle } from './ModeToggle'
import { StatusBar } from './StatusBar'
import { useConfigStore } from '../store/config'

interface LayoutProps {
  sidebar: ReactNode
  main: ReactNode
  rightPanel: ReactNode
}

export function Layout({ sidebar, main, rightPanel }: LayoutProps) {
  const advancedMode = useConfigStore((s) => s.advancedMode)

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-blue-400">RAG</span>
          <span className="text-lg font-light text-gray-400">Anything</span>
        </div>
        <ModeToggle />
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 overflow-y-auto">
          {sidebar}
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {main}
        </main>

        {/* Right Panel */}
        {advancedMode && (
          <aside className="w-80 flex-shrink-0 border-l border-gray-800 bg-gray-900/50 overflow-y-auto">
            {rightPanel}
          </aside>
        )}
      </div>

      <StatusBar />
    </div>
  )
}
```

- [ ] **Step 4: Create Sidebar**

```typescript
// webui/src/components/Sidebar.tsx
import { FolderTree } from './FolderTree'
import { FileList } from './FileList'

export function Sidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Folder</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <FolderTree />
      </div>
      <div className="border-t border-gray-800">
        <div className="p-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Documents</h2>
        </div>
        <div className="overflow-y-auto max-h-60 p-2">
          <FileList />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 10: Folder tree + file list

**Files:**
- Create: `webui/src/components/FolderTree.tsx`
- Create: `webui/src/components/FileList.tsx`

- [ ] **Step 1: Create FolderTree**

```typescript
// webui/src/components/FolderTree.tsx
import { useState, useEffect } from 'react'
import { api, type FolderItem } from '../lib/api'
import { useDocumentsStore } from '../store/documents'
import { usePipelineStore } from '../store/pipeline'

export function FolderTree() {
  const [items, setItems] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setFolder = useDocumentsStore((s) => s.setFolder)
  const setDocuments = useDocumentsStore((s) => s.setDocuments)
  const resetPipeline = usePipelineStore((s) => s.reset)
  const setStatus = usePipelineStore((s) => s.setStatus)

  useEffect(() => {
    api.folders.list('~').then(setItems).catch(() => {})
  }, [])

  const loadFolder = async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.folders.select(path)
      setFolder(result.folder)
      setDocuments(result.documents)
      resetPipeline()
      setStatus({ total: result.document_count })
    } catch (err: any) {
      setError(err.message || 'Failed to load folder')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      {loading && <span className="text-xs text-gray-500">Loading...</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
      {items
        .filter((i) => i.type === 'folder')
        .slice(0, 30)
        .map((item) => (
          <button
            key={item.path}
            onClick={() => loadFolder(item.path)}
            className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors truncate"
          >
            {item.name}
          </button>
        ))}
    </div>
  )
}
```

- [ ] **Step 2: Create FileList**

```typescript
// webui/src/components/FileList.tsx
import { useDocumentsStore } from '../store/documents'

const statusColor: Record<string, string> = {
  pending: 'text-gray-500',
  parsing: 'text-yellow-400',
  indexing: 'text-blue-400',
  ready: 'text-green-400',
  failed: 'text-red-400',
}

export function FileList() {
  const documents = useDocumentsStore((s) => s.documents)

  if (documents.length === 0) {
    return (
      <div className="text-xs text-gray-600 text-center py-4">
        Select a folder to scan documents
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {documents.map((doc) => (
        <div
          key={doc.path}
          className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-gray-800"
          title={doc.path}
        >
          <span className={`${statusColor[doc.status] || 'text-gray-500'} shrink-0`}>
            {doc.status === 'ready' ? '●' : doc.status === 'failed' ? '✕' : '○'}
          </span>
          <span className="truncate flex-1 text-gray-300">{doc.name}</span>
          <span className="text-gray-600 shrink-0">{(doc.size / 1024).toFixed(0)}KB</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 11: Chat components

**Files:**
- Create: `webui/src/components/ChatMessage.tsx`
- Create: `webui/src/components/ChatInput.tsx`
- Create: `webui/src/components/Chat.tsx`

- [ ] **Step 1: Create ChatMessage**

```typescript
// webui/src/components/ChatMessage.tsx
import { useState, useEffect } from 'react'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: { source: string; page?: number }[]
  streaming?: boolean
}

interface Props {
  message: Message
}

export function ChatMessage({ message }: Props) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!message.streaming) {
      setDisplayed(message.content)
      return
    }
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      i += 3
      if (i >= message.content.length) {
        setDisplayed(message.content)
        clearInterval(interval)
      } else {
        setDisplayed(message.content.slice(0, i))
      }
    }, 30)
    return () => clearInterval(interval)
  }, [message.content, message.streaming])

  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {displayed}
          {message.streaming && displayed !== message.content && (
            <span className="streaming-cursor" />
          )}
        </p>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700/50">
            <span className="text-xs text-gray-400">Sources: </span>
            {message.citations.map((c, i) => (
              <span
                key={i}
                className="inline-block mr-1 px-1.5 py-0.5 rounded bg-gray-700 text-xs text-gray-300"
              >
                {c.source}{c.page != null ? ` p.${c.page}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ChatInput**

```typescript
// webui/src/components/ChatInput.tsx
import { useState, useRef, type FormEvent } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleInput = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px'
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 p-4 border-t border-gray-800">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Ask a question about your documents..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Send
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create Chat**

```typescript
// webui/src/components/Chat.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { ChatMessage, type Message } from './ChatMessage'
import { ChatInput } from './ChatInput'

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Select a folder and start indexing to begin querying your documents.',
      streaming: false,
    },
  ])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: text, streaming: false }
    const assistantMsg: Message = { id: `assistant-${Date.now()}`, role: 'assistant', content: '', streaming: true }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, mode: 'mix' }),
      })
      if (!res.ok) throw new Error(await res.text())

      const reader = res.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'token') {
              fullContent += data.content
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.id === assistantMsg.id) last.content = fullContent
                return updated
              })
            } else if (data.type === 'citation' && data.source) {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.id === assistantMsg.id) {
                  last.citations = [...(last.citations || []), { source: data.source, page: data.page }]
                }
                return updated
              })
            }
          } catch { /* skip */ }
        }
      }
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last.id === assistantMsg.id) last.streaming = false
        return updated
      })
    } catch (err: any) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${err.message}`, streaming: false }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (<ChatMessage key={msg.id} message={msg} />))}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 12: Pipeline panel + Graph view

**Files:**
- Create: `webui/src/components/PipelinePanel.tsx`
- Create: `webui/src/components/GraphView.tsx`

- [ ] **Step 1: Create PipelinePanel**

```typescript
// webui/src/components/PipelinePanel.tsx
import { usePipelineStore } from '../store/pipeline'
import { useDocumentsStore } from '../store/documents'
import { usePipeline } from '../hooks/usePipeline'

const stages = [
  { key: 'idle', label: 'Idle' },
  { key: 'scanning', label: 'Scanning' },
  { key: 'parsing', label: 'Parsing' },
  { key: 'multimodal', label: 'Multimodal' },
  { key: 'graph', label: 'Knowledge Graph' },
  { key: 'complete', label: 'Complete' },
  { key: 'error', label: 'Error' },
]

export function PipelinePanel() {
  const status = usePipelineStore((s) => s.status)
  const folder = useDocumentsStore((s) => s.folder)
  const { start } = usePipeline()

  const currentIdx = stages.findIndex((s) => s.key === status.stage)

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Pipeline</h3>

      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                i < currentIdx ? 'bg-green-400'
                : i === currentIdx ? 'bg-blue-400 animate-pulse'
                : 'bg-gray-700'
              }`}
            />
            <span className={`text-xs ${i <= currentIdx ? 'text-gray-200' : 'text-gray-600'}`}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>

      {status.stage === 'idle' || status.stage === 'complete' ? (
        <button
          onClick={start}
          disabled={!folder || status.running}
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status.stage === 'complete' ? 'Re-index' : 'Start Indexing'}
        </button>
      ) : status.running ? (
        <p className="text-xs text-yellow-400 animate-pulse text-center">Processing...</p>
      ) : null}

      {!folder && <p className="text-xs text-gray-600 text-center">Select a folder first</p>}

      {status.total > 0 && (
        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-800">
          <div className="flex justify-between"><span>Total</span><span className="text-gray-300">{status.total}</span></div>
          <div className="flex justify-between"><span>Ready</span><span className="text-green-400">{status.ready}</span></div>
          <div className="flex justify-between"><span>Failed</span><span className="text-red-400">{status.failed}</span></div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create GraphView**

```typescript
// webui/src/components/GraphView.tsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface GraphData {
  nodes: { id: string; label: string }[]
  edges: { source: string; target: string; label?: string }[]
}

export function GraphView() {
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.graph.nodes()
      .then((res: any) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Knowledge Graph</h3>
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Knowledge Graph</h3>
        <p className="text-xs text-gray-600">No graph data yet. Index documents to build the knowledge graph.</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Knowledge Graph</h3>
      <p className="text-xs text-gray-500 mb-2">{data.nodes.length} entities, {data.edges.length} relations</p>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {data.nodes.slice(0, 50).map((node) => (
          <div key={node.id} className="flex items-center gap-2 px-2 py-1 rounded bg-gray-800 text-xs text-gray-300">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span className="truncate">{node.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 13: ConfigPanel

**Files:**
- Create: `webui/src/components/ConfigPanel.tsx`

- [ ] **Step 1: Create ConfigPanel**

```typescript
// webui/src/components/ConfigPanel.tsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useConfigStore } from '../store/config'

export function ConfigPanel() {
  const config = useConfigStore((s) => s.config)
  const setConfig = useConfigStore((s) => s.setConfig)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.config.get().then(setConfig).catch(() => {})
  }, [setConfig])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setMessage(null)
    try {
      await api.config.update(config as any)
      setMessage('Saved')
    } catch (err: any) {
      setMessage(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  if (!config) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Settings</h3>
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Settings</h3>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Parser</label>
        <select
          value={config.parser || 'mineru'}
          onChange={(e) => setConfig({ ...config, parser: e.target.value })}
          className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-300"
        >
          <option value="mineru">MinerU</option>
          <option value="docling">Docling</option>
          <option value="paddleocr">PaddleOCR</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Parse Method</label>
        <select
          value={config.parse_method || 'auto'}
          onChange={(e) => setConfig({ ...config, parse_method: e.target.value })}
          className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-300"
        >
          <option value="auto">Auto</option>
          <option value="ocr">OCR</option>
          <option value="txt">Text</option>
        </select>
      </div>

      <div className="space-y-2">
        <span className="block text-xs text-gray-500">Multimodal</span>
        {(['enable_image_processing', 'enable_table_processing', 'enable_equation_processing'] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(config as any)[key] ?? true}
              onChange={(e) => setConfig({ ...config, [key]: e.target.checked })}
              className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-300">
              {key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {message && (
        <p className={`text-xs text-center ${message === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 14: Wire everything in App.tsx

**Files:**
- Create: `webui/src/App.tsx`

- [ ] **Step 1: Create App.tsx**

```typescript
// webui/src/App.tsx
import { Layout } from './components/Layout'
import { Sidebar } from './components/Sidebar'
import { Chat } from './components/Chat'
import { PipelinePanel } from './components/PipelinePanel'
import { GraphView } from './components/GraphView'
import { ConfigPanel } from './components/ConfigPanel'
import { useConfigStore } from './store/config'

export default function App() {
  const advancedMode = useConfigStore((s) => s.advancedMode)

  return (
    <Layout
      sidebar={<Sidebar />}
      main={<Chat />}
      rightPanel={
        <div className="space-y-4">
          <PipelinePanel />
          <GraphView />
          {advancedMode && <ConfigPanel />}
        </div>
      }
    />
  )
}
```

- [ ] **Step 2: Build frontend**

Run: `cd /Users/linping-mac/RAG-Anything-Web/webui && npx vite build 2>&1 | tail -10`
Expected: Build succeeds, `dist/` created

---

### Task 15: Serve static frontend from backend

**Files:**
- Modify: `backend/app.py`

- [ ] **Step 1: Add static file serving to the end of `backend/app.py`**

```python
# ---- Static frontend serving ----
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_WEBUI_DIST = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "webui", "dist")
)

if os.path.isdir(_WEBUI_DIST):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(_WEBUI_DIST, "assets")),
        name="assets",
    )

    @app.get("/")
    async def serve_frontend():
        index = os.path.join(_WEBUI_DIST, "index.html")
        if os.path.isfile(index):
            return FileResponse(index, media_type="text/html")
        return {"error": "Frontend not built. Run 'cd webui && npm run build'"}
```

- [ ] **Step 2: Verify full-stack start**

Run: `cd /Users/linping-mac/RAG-Anything-Web && source .venv/bin/activate && python -m backend &`
Then: `curl -s http://127.0.0.1:8765/api/folders/list?path=/Users | head -c 200`
Expected: JSON array of folder items

Then: `kill %1 2>/dev/null; wait 2>/dev/null`

---

### Task 16: Add startup script

**Files:**
- Create: `start.sh`

- [ ] **Step 1: Create start script**

```bash
#!/usr/bin/env bash
# start.sh - Start RAG-Anything Web UI
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Build frontend if not already built
if [ ! -d "webui/dist" ]; then
    echo "Building frontend..."
    cd webui && npm install && npm run build && cd ..
fi

# Start backend
echo "Starting backend..."
source .venv/bin/activate
python -m backend
```

- [ ] **Step 2: Make executable**

Run: `chmod +x /Users/linping-mac/RAG-Anything-Web/start.sh`
