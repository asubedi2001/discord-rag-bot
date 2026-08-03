import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(() => {

  return {
    plugins: [
      tailwindcss(),
      react(),
    ],
    server: {
      host: true,
      port: 5173,
      allowedHosts: [
        'bot.aakash-subedi.com'
      ]
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: [
        'bot.aakash-subedi.com'
      ]
    }
  };
})

