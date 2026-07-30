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
    preview: {
      allowedHosts: [
        'bot.aakash-subedi.com',
        'aakash-subedi.com'
      ],
    },
    server: {
      allowedHosts: [
        'bot.aakash-subedi.com',
        'aakash-subedi.com'
      ],
    },
  };
})

