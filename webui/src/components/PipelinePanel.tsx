import { usePipelineStore } from '../store/pipeline'
import { useDocumentsStore } from '../store/documents'
import { usePipeline } from '../hooks/usePipeline'

const stages = [
  { key: 'idle', label: 'Idle' },
  { key: 'scanning', label: 'Scanning' },
  { key: 'parsing', label: 'Parsing' },
  { key: 'multimodal', label: 'Multimodal' },
  { key: 'graph', label: 'Knowledge Graph' },
  { key: 'complete', label: 'Complete' },
  { key: 'error', label: 'Error' },
]

export function PipelinePanel() {
  const status = usePipelineStore((s) => s.status)
  const folder = useDocumentsStore((s) => s.folder)
  const { start } = usePipeline()

  const currentIdx = stages.findIndex((s) => s.key === status.stage)

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Pipeline</h3>

      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                i < currentIdx ? 'bg-green-400'
                : i === currentIdx ? 'bg-blue-400 animate-pulse'
                : 'bg-gray-700'
              }`}
            />
            <span className={`text-xs ${i <= currentIdx ? 'text-gray-200' : 'text-gray-600'}`}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>

      {status.stage === 'idle' || status.stage === 'complete' ? (
        <button
          onClick={start}
          disabled={!folder || status.running}
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status.stage === 'complete' ? 'Re-index' : 'Start Indexing'}
        </button>
      ) : status.running ? (
        <p className="text-xs text-yellow-400 animate-pulse text-center">Processing...</p>
      ) : null}

      {!folder && <p className="text-xs text-gray-600 text-center">Select a folder first</p>}

      {status.total > 0 && (
        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-800">
          <div className="flex justify-between"><span>Total</span><span className="text-gray-300">{status.total}</span></div>
          <div className="flex justify-between"><span>Ready</span><span className="text-green-400">{status.ready}</span></div>
          <div className="flex justify-between"><span>Failed</span><span className="text-red-400">{status.failed}</span></div>
        </div>
      )}
    </div>
  )
}
