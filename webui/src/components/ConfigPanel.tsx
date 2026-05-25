import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useConfigStore } from '../store/config'

export function ConfigPanel() {
  const config = useConfigStore((s) => s.config)
  const setConfig = useConfigStore((s) => s.setConfig)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.config.get().then(setConfig).catch(() => {})
  }, [setConfig])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setMessage(null)
    try {
      await api.config.update(config as any)
      setMessage('Saved')
    } catch (err: any) {
      setMessage(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  if (!config) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Settings</h3>
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Settings</h3>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Parser</label>
        <select
          value={config.parser || 'mineru'}
          onChange={(e) => setConfig({ ...config, parser: e.target.value })}
          className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-300"
        >
          <option value="mineru">MinerU</option>
          <option value="docling">Docling</option>
          <option value="paddleocr">PaddleOCR</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">LLM Model</label>
        <input
          type="text"
          value={(config as any).llm_model || 'gpt-4o-mini'}
          onChange={(e) => setConfig({ ...config, llm_model: e.target.value })}
          placeholder="e.g. gpt-4o-mini, claude-3-haiku"
          className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Embedding Model</label>
        <input
          type="text"
          value={(config as any).embedding_model || 'text-embedding-3-small'}
          onChange={(e) => setConfig({ ...config, embedding_model: e.target.value })}
          placeholder="e.g. text-embedding-3-small"
          className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">OpenAI API Key</label>
        <input
          type="password"
          value={(config as any).openai_api_key || ''}
          onChange={(e) => setConfig({ ...config, openai_api_key: e.target.value })}
          placeholder="sk-..."
          className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">OpenAI Base URL</label>
        <input
          type="text"
          value={(config as any).openai_base_url || ''}
          onChange={(e) => setConfig({ ...config, openai_base_url: e.target.value })}
          placeholder="https://api.openai.com/v1 (optional)"
          className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Parse Method</label>
        <select
          value={config.parse_method || 'auto'}
          onChange={(e) => setConfig({ ...config, parse_method: e.target.value })}
          className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-300"
        >
          <option value="auto">Auto</option>
          <option value="ocr">OCR</option>
          <option value="txt">Text</option>
        </select>
      </div>

      <div className="space-y-2">
        <span className="block text-xs text-gray-500">Multimodal</span>
        {(['enable_image_processing', 'enable_table_processing', 'enable_equation_processing'] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(config as any)[key] ?? true}
              onChange={(e) => setConfig({ ...config, [key]: e.target.checked })}
              className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-300">
              {key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {message && (
        <p className={`text-xs text-center ${message === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
