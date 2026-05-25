import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { Sidebar } from './components/Sidebar'
import { Chat } from './components/Chat'
import { PipelinePanel } from './components/PipelinePanel'
import { GraphView } from './components/GraphView'
import { ConfigPanel } from './components/ConfigPanel'
import { useConfigStore } from './store/config'
import { api } from './lib/api'

export default function App() {
  const advancedMode = useConfigStore((s) => s.advancedMode)
  const setConfig = useConfigStore((s) => s.setConfig)

  useEffect(() => {
    api.config.get().then(setConfig).catch(() => {})
  }, [setConfig])

  return (
    <Layout
      sidebar={<Sidebar />}
      main={<Chat />}
      rightPanel={
        <div className="space-y-4">
          <PipelinePanel />
          <GraphView />
          {advancedMode && <ConfigPanel />}
        </div>
      }
    />
  )
}
