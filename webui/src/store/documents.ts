import { create } from 'zustand'

export interface Document {
  path: string
  name: string
  size: number
  type: string
  status: 'pending' | 'parsing' | 'indexing' | 'ready' | 'failed'
  progress: number
  error?: string
}

interface DocumentsState {
  folder: string | null
  documents: Document[]
  setFolder: (path: string) => void
  setDocuments: (docs: Document[]) => void
  updateDocument: (path: string, updates: Partial<Document>) => void
  clear: () => void
}

export const useDocumentsStore = create<DocumentsState>((set) => ({
  folder: null,
  documents: [],
  setFolder: (path) => set({ folder: path }),
  setDocuments: (documents) => set({ documents }),
  updateDocument: (path, updates) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.path === path ? { ...d, ...updates } : d
      ),
    })),
  clear: () => set({ folder: null, documents: [] }),
}))
