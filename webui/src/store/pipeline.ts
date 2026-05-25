import { create } from 'zustand'

export interface PipelineState {
  stage: string
  running: boolean
  total: number
  ready: number
  failed: number
  message: string | null
}

interface PipelineStore {
  status: PipelineState
  setStatus: (updates: Partial<PipelineState>) => void
  reset: () => void
}

const defaultStatus: PipelineState = {
  stage: 'idle',
  running: false,
  total: 0,
  ready: 0,
  failed: 0,
  message: null,
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  status: { ...defaultStatus },
  setStatus: (updates) =>
    set((state) => ({ status: { ...state.status, ...updates } })),
  reset: () => set({ status: { ...defaultStatus } }),
}))
