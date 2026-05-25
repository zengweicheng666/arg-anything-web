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
