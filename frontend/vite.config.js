import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// One platform, one origin: the Node gateway (port 3000) serves every API — including the
// CyberRakshak ML engine under /api/v1/ml/* — so the dev server only needs a single proxy.
// In production, `npm run build` output (dist/) is served by the gateway itself.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://127.0.0.1:3000',
        },
    },
})
