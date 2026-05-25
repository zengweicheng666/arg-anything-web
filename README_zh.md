# RAG-Anything Web UI

[English](README.md) | **中文**

[RAG-Anything](https://github.com/HKUDS/RAG-Anything) 的 Web 界面 — 多模态 RAG（检索增强生成）流水线。

## 功能

- **三栏布局**：文件夹/文档侧栏、聊天区域、管理面板
- **简单/高级模式**：在简洁聊天视图和完整管理界面之间切换
- **文档索引**：选择本地文件夹，扫描支持的文档，运行完整的索引流水线
- **流式问答**：基于文档内容提问，实时流式获取回答
- **知识图谱**：查看提取的实体和关系
- **设置管理**：配置解析器、LLM 模型、Embedding 模型、API 密钥

## 前置依赖

本 UI 依赖 [RAG-Anything](https://github.com/HKUDS/RAG-Anything) 作为核心引擎。请先安装：

```bash
git clone https://github.com/HKUDS/RAG-Anything.git
cd RAG-Anything
pip install -e .
cd ..
```

验证安装：

```bash
pip show raganything
# 或
python -c "import raganything; print(raganything.__version__)"
```

## 快速开始

```bash
# 安装后端依赖
pip install -e .

# 安装前端依赖
cd webui && npm install && cd ..

# 构建前端
cd webui && npm run build && cd ..

# 启动服务
python -m backend
```

打开 http://127.0.0.1:8765

### 或使用启动脚本

```bash
chmod +x start.sh
./start.sh
```

启动后，右上角会显示 `raganything` 和 `mineru` 的版本号。

## 使用说明

1. **设置** — 在高级模式（右上角切换）中配置 OpenAI API Key 和 LLM 模型，点击保存
2. **选择文件夹** — 在左侧栏选择包含文档（PDF、图片、Markdown 等）的文件夹
3. **索引** — 点击 "Start Indexing" 开始处理文档
4. **提问** — 在聊天面板中询问文档相关的问题

## 技术栈

- **后端**：Python, FastAPI, Uvicorn
- **前端**：React 18, TypeScript, Vite, Tailwind CSS
- **RAG 引擎**：RAG-Anything, LightRAG

## 项目结构

```
├── backend/
│   ├── app.py                # FastAPI 应用 + 路由 + WebSocket
│   ├── models.py             # Pydantic 模型
│   └── pipeline_manager.py   # 文档索引流水线
├── webui/                    # React + Vite 前端
├── pyproject.toml
└── start.sh
```
