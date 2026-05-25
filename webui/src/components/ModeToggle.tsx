import { useConfigStore } from '../store/config'

export function ModeToggle() {
  const advancedMode = useConfigStore((s) => s.advancedMode)
  const setAdvancedMode = useConfigStore((s) => s.setAdvancedMode)

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${!advancedMode ? 'text-blue-400' : 'text-gray-500'}`}>
        Simple
      </span>
      <button
        onClick={() => setAdvancedMode(!advancedMode)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          advancedMode ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            advancedMode ? 'translate-x-[18px]' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`text-xs ${advancedMode ? 'text-blue-400' : 'text-gray-500'}`}>
        Advanced
      </span>
    </div>
  )
}
