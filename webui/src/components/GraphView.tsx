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
