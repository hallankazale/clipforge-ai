import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // O app empacotado é aberto via file://. Caminhos absolutos como /assets/...
  // apontam para a raiz do disco e deixam o renderer sem JS/CSS. Assets relativos
  // funcionam tanto no desenvolvimento quanto dentro do app.asar do Electron.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
