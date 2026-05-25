import type { ReactNode } from 'react'
import { ModeToggle } from './ModeToggle'
import { StatusBar } from './StatusBar'
import { useConfigStore } from '../store/config'

interface LayoutProps {
  sidebar: ReactNode
  main: ReactNode
  rightPanel: ReactNode
}

export function Layout({ sidebar, main, rightPanel }: LayoutProps) {
  const advancedMode = useConfigStore((s) => s.advancedMode)
  const config = useConfigStore((s) => s.config)

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-blue-400">RAG</span>
          <span className="text-lg font-light text-gray-400">Anything</span>
        </div>
        <div className="flex items-center gap-4">
          {config?.raganything_version && (
            <span className="text-xs text-gray-500">
              raganything <span className="text-gray-400">{config.raganything_version}</span>
            </span>
          )}
          {config?.mineru_version && (
            <span className="text-xs text-gray-500">
              mineru <span className="text-gray-400">{config.mineru_version}</span>
            </span>
          )}
          <ModeToggle />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 overflow-y-auto">
          {sidebar}
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {main}
        </main>

        {/* Right Panel */}
        {advancedMode && (
          <aside className="w-80 flex-shrink-0 border-l border-gray-800 bg-gray-900/50 overflow-y-auto">
            {rightPanel}
          </aside>
        )}
      </div>

      <StatusBar />
    </div>
  )
}
