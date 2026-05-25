import { create } from 'zustand'

interface RagConfig {
  working_dir?: string
  parser?: string
  parse_method?: string
  llm_model?: string
  embedding_model?: string
  openai_api_key?: string
  openai_base_url?: string
  llm_model_func?: string | null
  embedding_func?: string | null
  enable_image_processing?: boolean
  enable_table_processing?: boolean
  enable_equation_processing?: boolean
  raganything_version?: string
  mineru_version?: string
}

interface ConfigStore {
  config: RagConfig | null
  advancedMode: boolean
  setConfig: (config: RagConfig) => void
  setAdvancedMode: (on: boolean) => void
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,
  advancedMode: false,
  setConfig: (config) => set({ config }),
  setAdvancedMode: (advancedMode) => set({ advancedMode }),
}))
