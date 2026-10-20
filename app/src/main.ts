import { createApp } from 'vue'
import App from './App.vue'
import { rawState, pick, submitDraw } from './logic/store'
import './styles/tokens.css'
import './styles/main.css'
import '../../core/chrome.css'

createApp(App).mount('#app')

// dev hook：冒烟测试（tools/smoke.mjs）通过 ?dev=hey 暴露当日题状态与答题函数。
// 暴露原始 state（普通对象），readonly 代理经浏览器序列化会丢数组性。
if (location.search.includes('dev=hey')) {
  ;(window as unknown as Record<string, unknown>).__jiagu = { store: rawState, pick, submitDraw }
}
