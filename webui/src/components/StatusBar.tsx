import { usePipelineStore } from '../store/pipeline'
import { useDocumentsStore } from '../store/documents'
import { useConfigStore } from '../store/config'

export function StatusBar() {
  const status = usePipelineStore((s) => s.status)
  const docs = useDocumentsStore((s) => s.documents)
  const config = useConfigStore((s) => s.config)

  return (
    <div className="flex items-center justify-between border-t border-gray-800 bg-gray-900 px-4 py-1 text-xs text-gray-500">
      <div className="flex items-center gap-4">
        <span>Stage: <span className="text-gray-300">{status.stage}</span></span>
        <span>Docs: <span className="text-gray-300">{docs.length}</span></span>
        {status.ready > 0 && (
          <span>Indexed: <span className="text-green-400">{status.ready}</span></span>
        )}
        {status.failed > 0 && (
          <span>Failed: <span className="text-red-400">{status.failed}</span></span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {status.running && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            Processing...
          </span>
        )}
        <span>LLM: {config?.llm_model_func || 'not set'}</span>
      </div>
    </div>
  )
}
