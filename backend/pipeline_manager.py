# /Users/linping-mac/RAG-Anything-Web/backend/pipeline_manager.py
from __future__ import annotations

import asyncio
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
            ready_count = sum(1 for d in self._documents if d["status"] == "ready")
            if ready_count == 0:
                self._current_stage = "error"
            else:
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
