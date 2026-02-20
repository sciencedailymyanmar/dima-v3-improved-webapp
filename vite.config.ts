import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/dima-v3-improved-webapp/',
  plugins: [react()],
})
