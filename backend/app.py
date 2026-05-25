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

# ---- Config persistence ----
_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "..", "config.json")


def _load_saved_config() -> dict:
    """Load previously saved config from disk."""
    cfg_path = Path(_CONFIG_FILE)
    if not cfg_path.exists():
        return {}
    try:
        data = json.loads(cfg_path.read_text())
        for key, value in data.items():
            if value is not None:
                os.environ[key] = str(value)
        logger.info(f"Loaded saved config: {list(data.keys())}")
        return data
    except Exception as exc:
        logger.warning(f"Failed to load saved config: {exc}")
        return {}


def _save_config_to_disk(updates: dict) -> None:
    """Persist config to disk so it survives server restarts."""
    cfg_path = Path(_CONFIG_FILE)
    # Load existing saved config
    existing = {}
    if cfg_path.exists():
        try:
            existing = json.loads(cfg_path.read_text())
        except Exception:
            pass
    existing.update(updates)
    # Only keep env-var-persistable keys
    keep_keys = {
        "OPENAI_API_KEY", "OPENAI_BASE_URL", "LLM_MODEL", "EMBEDDING_MODEL",
        "PARSER", "PARSE_METHOD", "ENABLE_IMAGE_PROCESSING",
        "ENABLE_TABLE_PROCESSING", "ENABLE_EQUATION_PROCESSING",
    }
    filtered = {k: v for k, v in existing.items() if k in keep_keys and v is not None}
    try:
        cfg_path.parent.mkdir(parents=True, exist_ok=True)
        cfg_path.write_text(json.dumps(filtered, indent=2))
        logger.info(f"Config saved to {cfg_path}")
    except Exception as exc:
        logger.warning(f"Failed to save config: {exc}")


# Load persisted config at startup
_saved = _load_saved_config()


def _try_init_llm_from_env(rag: RAGAnything) -> None:
    """Try to create LLM and embedding functions from environment variables."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return
    try:
        from lightrag.llm.openai import openai_complete_if_cache, openai_embed

        rag.llm_model_func = openai_complete_if_cache
        rag.embedding_func = openai_embed
        # Bypass parser check - we only need LightRAG for queries, not parsing
        rag._parser_installation_checked = True
        logger.info("LLM functions initialized from environment variables")
    except Exception as exc:
        logger.warning(f"Failed to initialize LLM functions: {exc}")


def _ensure_rag() -> RAGAnything:
    global _rag
    if _rag is None:
        _rag = RAGAnything()
        # Try to set up LLM function from env vars if available
        _try_init_llm_from_env(_rag)
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
            # Try to initialize LightRAG if not already done (requires LLM config)
            if rag.lightrag is None:
                init_result = await rag._ensure_lightrag_initialized()
                if not init_result or not init_result.get("success"):
                    yield f"data: {json.dumps({'type': 'error', 'content': 'LightRAG not initialized. Set API Key in Settings and index documents first.'})}\n\n"
                    return
            response = await rag.aquery(req.query, mode=req.mode, system_prompt=req.system_prompt)
            if not response:
                response = "没有找到相关文档内容。请先选择一个文件夹并索引文档。"
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
    info = rag.get_config_info()
    info["llm_model"] = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    info["embedding_model"] = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
    info["openai_api_key"] = os.environ.get("OPENAI_API_KEY", "")
    info["openai_base_url"] = os.environ.get("OPENAI_BASE_URL", "")
    # Version info
    try:
        from importlib.metadata import version
        info["raganything_version"] = version("raganything")
    except Exception:
        info["raganything_version"] = None
    try:
        from importlib.metadata import version
        info["mineru_version"] = version("mineru")
    except Exception:
        info["mineru_version"] = None
    return info


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
    if update.llm_model is not None:
        os.environ["LLM_MODEL"] = update.llm_model
        _save_config_to_disk({"LLM_MODEL": update.llm_model})
        if rag.lightrag is not None:
            rag.lightrag.global_config["llm_model_name"] = update.llm_model
    if update.embedding_model is not None:
        os.environ["EMBEDDING_MODEL"] = update.embedding_model
        _save_config_to_disk({"EMBEDDING_MODEL": update.embedding_model})
    if update.openai_api_key is not None:
        os.environ["OPENAI_API_KEY"] = update.openai_api_key
        _save_config_to_disk({"OPENAI_API_KEY": update.openai_api_key})
        _try_init_llm_from_env(rag)
    if update.openai_base_url is not None:
        os.environ["OPENAI_BASE_URL"] = update.openai_base_url
        _save_config_to_disk({"OPENAI_BASE_URL": update.openai_base_url})
    if update.parser is not None:
        _save_config_to_disk({"PARSER": update.parser})
    if update.parse_method is not None:
        _save_config_to_disk({"PARSE_METHOD": update.parse_method})
    if update.enable_image_processing is not None:
        _save_config_to_disk({"ENABLE_IMAGE_PROCESSING": str(update.enable_image_processing)})
    if update.enable_table_processing is not None:
        _save_config_to_disk({"ENABLE_TABLE_PROCESSING": str(update.enable_table_processing)})
    if update.enable_equation_processing is not None:
        _save_config_to_disk({"ENABLE_EQUATION_PROCESSING": str(update.enable_equation_processing)})
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
