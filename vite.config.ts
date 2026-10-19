import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 源码在 app/ 子目录（2026-10-19 结构改造）：jiagu 的 Pages 源是 branch main
// （部署历史实证），main 根必须放构建产物——根的 index.html 是产物，源码入口在
// app/index.html，两者不再抢同一条路径。dev/build 一律以 app/ 为根。
export default defineConfig({
  root: 'app',
  plugins: [vue()],
  server: { port: 5173 },
  build: { outDir: 'dist' }, // 相对 root → app/dist；deploy 时拷到仓库根
})
