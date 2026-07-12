import { routeTypesPlugin } from '@guren/cli/vite'
import { defineConfig } from 'vite'
import guren from '@guren/core/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  publicDir: false,
  plugins: [routeTypesPlugin(), guren(), react()],
})
