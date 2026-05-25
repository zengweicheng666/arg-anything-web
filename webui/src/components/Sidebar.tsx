import { FolderTree } from './FolderTree'
import { FileList } from './FileList'

export function Sidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Folder</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <FolderTree />
      </div>
      <div className="border-t border-gray-800">
        <div className="p-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Documents</h2>
        </div>
        <div className="overflow-y-auto max-h-60 p-2">
          <FileList />
        </div>
      </div>
    </div>
  )
}
