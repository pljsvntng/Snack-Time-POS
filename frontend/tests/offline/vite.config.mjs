import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({plugins:[react()],resolve:{alias:[{find:'@capacitor/app',replacement:path.join(dir,'app-browser.mjs')},{find:/^(.*\/)?offline\/runtime(\.js)?$/,replacement:path.join(dir,'runtime-browser.mjs')}]}});
