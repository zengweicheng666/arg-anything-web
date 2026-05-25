# RAG-Anything Web UI

**English** | [中文](README_zh.md)

A web interface for [RAG-Anything](https://github.com/HKUDS/RAG-Anything) — a multimodal RAG (Retrieval-Augmented Generation) pipeline.

## Features

- **Three-column layout**: folder/document sidebar, chat area, management panels
- **Simple / Advanced mode**: toggle between minimal chat view and full management UI
- **Document indexing**: select a local folder, scan supported documents, run the full indexing pipeline
- **Streaming Q&A**: ask questions about your documents with real-time streaming responses
- **Knowledge graph**: view extracted entities and relations
- **Settings management**: configure parser, LLM model, embedding model, API keys

## Quick Start

```bash
# Install dependencies
pip install -e .

# Install frontend dependencies
cd webui && npm install && cd ..

# Build frontend
cd webui && npm run build && cd ..

# Start server
python -m backend
```

Open http://127.0.0.1:8765

### Or use the startup script

```bash
chmod +x start.sh
./start.sh
```

## Usage

1. **Settings** — In Advanced mode (toggle top-right), configure your OpenAI API Key and LLM model, then click Save
2. **Select folder** — Choose a folder with documents (PDF, images, markdown, etc.) from the left sidebar
3. **Index** — Click "Start Indexing" to process documents
4. **Query** — Ask questions about your documents in the chat panel

## Tech Stack

- **Backend**: Python, FastAPI, Uvicorn
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **RAG Engine**: RAG-Anything, LightRAG

## Project Structure

```
├── backend/
│   ├── app.py                # FastAPI app + routes + WebSocket
│   ├── models.py             # Pydantic models
│   └── pipeline_manager.py   # Document indexing pipeline
├── webui/                    # React + Vite frontend
├── pyproject.toml
└── start.sh
```
