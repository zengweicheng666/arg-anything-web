import { useState, useEffect } from 'react'
import { api, type FolderItem } from '../lib/api'
import { useDocumentsStore } from '../store/documents'
import { usePipelineStore } from '../store/pipeline'

export function FolderTree() {
  const [items, setItems] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const folder = useDocumentsStore((s) => s.folder)
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
            className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors truncate ${
              folder === item.path
                ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {item.name}
          </button>
        ))}
    </div>
  )
}
