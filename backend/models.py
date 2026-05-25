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
    openai_api_key: Optional[str] = None
    openai_base_url: Optional[str] = None
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
