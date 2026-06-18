import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/live_cache.json',
        '**/accounts.json',
        '**/settings.json',
        '**/session_*.json',
        '**/token.txt',
        '**/*.log',
        '**/uploads/**',
        '**/dados_instagram_filtrados/**',
        '**/seguidores/**',
        '**/notas/**'
      ]
    }
  }
})
