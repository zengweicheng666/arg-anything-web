# RAG-Anything Web UI Design Spec

**Date:** 2026-05-25
**Status:** Draft

## 1. Overview

RAG-Anything is a Python multimodal RAG library (based on LightRAG) with no built-in
visual interface. This spec describes a web UI that wraps the library, providing both
a simple chat interface for casual users and an advanced management view for developers.

## 2. Architecture

```
Frontend (React + Vite + Tailwind + shadcn/ui)
    │
    ├── REST API (FastAPI)
    └── WebSocket (FastAPI)
              │
         RAGAnything Core
         (Parser → LightRAG → Knowledge Graph)
              │
         Local File System
```

- **Backend:** FastAPI — matches RAGAnything's async nature
- **Realtime:** WebSocket for pipeline progress + streaming query responses
- **Storage:** No external DB needed; RAGAnything manages its own KV storage in working_dir
- **File access:** Direct local filesystem access — no upload required for local folders

## 3. Page Layout

Three-column structure that adapts to Simple / Advanced mode:

```
┌────────────────────────────────────────────────────────┐
│  Header: Logo | RAG-Anything | Mode Toggle (Simple/Adv)│
├──────────┬────────────────────────────┬─────────────────┤
│Left Sidebar│     Main Area            │  Right Panel    │
│            │                          │  (collapsible)  │
│ Folder     │  Chat View               │  Pipeline       │
│ Selector   │  (message list + input)  │  Progress       │
│            │                          │                 │
│ Document   │  - Text query            │  Graph Viz      │
│ List       │  - Multimodal (drag img) │  (force graph)  │
│            │  - Streaming responses   │                 │
│ Status     │  - Source citations      │  Config Panel   │
│ Indicators │                          │  (Adv mode)     │
└──────────┴────────────────────────────┴─────────────────┘
│  Status Bar: indexing state | doc count | LLM model      │
└──────────────────────────────────────────────────────────┘
```

### Simple Mode
- Right panel collapsed by default
- Left sidebar: folder selector + document list only
- Main area: full-width chat
- Input supports drag-and-drop files for multimodal queries

### Advanced Mode
- Right panel expanded: pipeline progress, knowledge graph visualization
- Left sidebar: per-document parse details, processing logs
- Chat input: query mode selector (local/global/hybrid/mix), parameter controls
- Settings button in header

## 4. User Flow

```
① Select folder → ② Scan documents → ③ Start indexing
    → ④ Pipeline progress (realtime) → ⑤ Chat ready
    → ⑥ Ask questions → streaming answers with citations
```

### 4.1 Folder Selection
- Backend lists local directory tree via API
- Frontend renders tree selector
- User picks a folder containing documents

### 4.2 Document Scanning
- Backend scans folder for supported extensions
  (PDF, JPG, PNG, DOCX, PPTX, XLSX, TXT, MD)
- Frontend displays file list with status icons
- User can exclude specific files before indexing

### 4.3 Pipeline Execution
- User clicks "Start Indexing"
- Backend runs: parse docs → process multimodal content → build knowledge graph
- Progress pushed via WebSocket to right panel
- Each stage shows: filename, progress bar, status (pending/processing/done/failed)
- On completion, Chat view activates automatically

### 4.4 Chat / Query
- User types question → streaming response via WebSocket
- Response rendered token-by-token (typewriter effect)
- Source citations linked to document info
- Multimodal: drag image into input → `aquery_with_multimodal`
- VLM Enhanced mode: automatically embeds images from retrieved context

## 5. Core API Endpoints

### File Management
```
GET  /api/folders/list?path=~       # List directory tree (default: home dir)
POST /api/folders/select            # Set working folder (full path in body)
GET  /api/documents                 # List scanned documents
```

### Pipeline
```
POST /api/pipeline/start            # Start indexing pipeline
GET  /api/pipeline/status           # Get current pipeline status
```

### Query
```
POST /api/query                     # Send text query (streaming)
POST /api/query/multimodal          # Multimodal query with images
```

### Knowledge Graph
```
GET  /api/graph/nodes               # Get graph nodes & edges
```

### Configuration
```
GET  /api/config                    # Current RAGAnything config
PUT  /api/config                    # Update config
```

### WebSocket
```
WS   /ws/pipeline                   # Pipeline progress events
WS   /ws/query                      # Streaming query responses
```

## 6. Data Model

### Document
```
{
  "path": "/path/to/doc.pdf",
  "name": "doc.pdf",
  "size": 1234567,
  "type": "pdf",
  "status": "pending | parsing | indexing | ready | failed",
  "parse_method": "auto",
  "progress": 0.0,
  "error": null
}
```

### Pipeline Event (WebSocket)
```
{
  "event": "stage_update",
  "stage": "parsing | multimodal | graph | complete",
  "file": "doc.pdf",
  "progress": 0.75,
  "status": "processing",
  "message": "Processing page 12/20"
}
```

### Query Response (WebSocket stream)
```
# Token stream
{"type": "token", "content": "Based on"}

# Citation
{"type": "citation", "source": "doc.pdf", "page": 5}

# Complete
{"type": "done", "usage": {"input_tokens": 150, "output_tokens": 200}}
```

## 7. Technology Choices

### Frontend
| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18 + Vite | Fast dev experience, broad ecosystem |
| State | Zustand | Lightweight, sufficient for this scope |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI development |
| Graph viz | React Flow | Mature, React-native node/edge rendering |
| Streaming | WebSocket client | Bi-directional, needed for pipeline + query |

### Backend
| Layer | Choice | Rationale |
|---|---|---|
| Framework | FastAPI | Native async, automatic OpenAPI docs |
| Realtime | WebSocket (FastAPI) | Pipeline progress + streaming query |
| Task mgmt | asyncio | Single-user, no external queue needed |

## 8. Security Considerations

- Backend only reads files from user-selected local paths
- No file upload to external services
- LLM API keys stored in environment variables or backend config
- Path traversal protection on folder/file listing endpoints
- No authentication layer for v1 (local-only single-user app)

## 9. Error Handling

### Frontend
- Pipeline failures shown inline per-file with error message and retry button
- Connection loss (WebSocket drop) auto-reconnects with exponential backoff
- Query timeout shows user-facing message with retry option
- Empty states: friendly messages for "no documents", "no results", "select a folder first"

### Backend
- Parse failures captured per-document, non-blocking to other documents
- Invalid LLM/Embedding config caught at startup, returned as clear error to frontend
- LLM rate-limit / API errors propagated as actionable messages
- Graceful shutdown: in-flight queries complete or timeout within a deadline

## 10. Future Considerations (Out of Scope for v1)

- Multi-user support with authentication
- Remote file storage integrations (S3, Google Drive, etc.)
- Document comparison / diff view
- Custom prompt templates library
- Export query results (PDF, Markdown)

## 11. Out of Scope (v1)

- User authentication / multi-tenancy
- Remote file storage (S3, etc.)
- Custom prompt builder
- Mobile responsive layout
- Internationalization (i18n)
