import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 必須與您的 GitHub Repository 名稱完全一致，大小寫須相符
  base: '/TFDA-drug-shortage-dashboard/', 
})
