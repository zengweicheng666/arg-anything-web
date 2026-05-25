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
