/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_NANO_BANANA_API_KEY: string
  readonly VITE_LULU_CLIENT_KEY: string
  readonly VITE_LULU_CLIENT_SECRET: string
  readonly VITE_LULU_ENVIRONMENT: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
