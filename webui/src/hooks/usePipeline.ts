import { useCallback } from 'react'
import { usePipelineStore } from '../store/pipeline'
import { useDocumentsStore } from '../store/documents'
import { useWebSocket } from './useWebSocket'
import { api } from '../lib/api'

export function usePipeline() {
  const setStatus = usePipelineStore((s) => s.setStatus)
  const updateDocument = useDocumentsStore((s) => s.updateDocument)

  const handleEvent = useCallback(
    (data: any) => {
      if (!data || !data.event) return
      if (data.event === 'stage_update') {
        setStatus({
          stage: data.stage,
          message: data.message || null,
        })
        if (data.stage === 'complete') {
          setStatus({ running: false })
        }
      }
      if (data.file && data.status) {
        const docStatus =
          data.status === 'done' ? 'ready'
          : data.status === 'failed' ? 'failed'
          : data.status === 'processing' ? 'parsing'
          : 'pending'
        updateDocument(data.file, { status: docStatus as any })
      }
    },
    [setStatus, updateDocument]
  )

  useWebSocket('/ws/pipeline', handleEvent)

  const start = useCallback(async () => {
    setStatus({ running: true, stage: 'starting', message: 'Starting...' })
    await api.pipeline.start()
    const status = await api.pipeline.status()
    setStatus({ total: status.total, ready: status.ready, failed: status.failed })
  }, [setStatus])

  const refresh = useCallback(async () => {
    const status = await api.pipeline.status()
    setStatus({
      stage: status.stage,
      running: status.running,
      total: status.total,
      ready: status.ready,
      failed: status.failed,
    })
  }, [setStatus])

  return { start, refresh }
}
