<script setup lang="ts">
// 顶栏：牌子 | 八项乐园 | 明暗钮。与 diuci.com、k12、lian、handle 同一形状（规范 §2）。
//
// 本站不摆繁简钮：内容是古文字与今字对照，不存在简繁两套，按规范 §3「不许静默择一」
// 摆了就是点了没反应。已在 tools/check-ui.config.json 里写明豁免与原因。
import { ref, onMounted } from 'vue'
import { toggleTheme as coreToggle } from '../../../core/theme.mjs'
import parksData from '../../../core/parks.json'

const dark = ref(false)

function apply(v: boolean) {
  const el = document.documentElement
  el.setAttribute('data-theme', v ? 'dark' : 'light')
  el.classList.toggle('dark', v)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', v ? '#17140f' : '#f4ede0')
}

// 切换走统一核心 core/theme（PLAN-全站统一-v2 追加）：本组件只留按钮态
function toggleTheme() {
  dark.value = coreToggle() === 'dark'
}

onMounted(() => {
  let v = false
  try { v = localStorage.getItem('dc-theme') === 'dark' } catch {}
  dark.value = v
  apply(v)
})

// 顶栏乐园数据单源 core/parks.json（当前项按 hostname 判定）
const PARKS = parksData.parks.map((p) => ({
  ...p,
  on: typeof location !== 'undefined' && p.href.includes(location.hostname),
}))
</script>

<template>
  <nav class="dc-nav">
    <a class="dc-brand" href="https://diuci.com/">
      <span class="dc-seal">画</span>
      <span class="dc-brand-t">画甲骨</span>
    </a>
    <div class="dc-nav-links" aria-label="八个乐园">
      <a v-for="p in PARKS" :key="p.href" :href="p.href"
         :aria-current="p.on ? 'page' : undefined" :class="{ on: p.on }">{{ p.label }}</a>
    </div>
    <button class="dc-theme-btn" type="button" aria-label="切换深色模式" title="切换深色模式" @click="toggleTheme">
      <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2"/>
        <path d="M12 2.4v2.1M12 19.5v2.1M2.4 12h2.1M19.5 12h2.1M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M18.8 5.2l-1.5 1.5M6.7 17.3l-1.5 1.5"/>
      </svg>
      <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8z"/>
      </svg>
    </button>
  </nav>
</template>

<style scoped>
.dc-nav{
  display:flex;align-items:center;gap:12px;
  padding:10px 16px;
  background:var(--nav-bg);
  backdrop-filter:blur(18px) saturate(1.4);
  -webkit-backdrop-filter:blur(18px) saturate(1.4);
  border-bottom:1px solid var(--line);
  position:sticky;top:0;z-index:50;
}
.dc-brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);flex:none}
.dc-seal{
  width:30px;height:30px;border-radius:7px;flex:none;
  background:var(--cinnabar);color:#f7f1e3;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--brush);font-size:18px;line-height:1;
}
.dc-brand-t{font-family:var(--round);font-size:16px;letter-spacing:.04em;white-space:nowrap}
.dc-nav-links{
  display:flex;align-items:center;gap:2px;flex:1 1 auto;
  min-width:0;overflow-x:auto;scrollbar-width:none;
}
.dc-nav-links::-webkit-scrollbar{display:none}
.dc-nav-links a{
  padding:6px 9px;border-radius:9px;text-decoration:none;
  color:var(--ink-soft);font-size:13.5px;white-space:nowrap;
  transition:color .18s,background .18s;
}
.dc-nav-links a:hover{color:var(--cinnabar);background:var(--wash-2)}
.dc-nav-links a.on{color:var(--cinnabar);background:var(--wash-2);font-weight:600}
/* 明暗钮：尺寸取自正本，规范 §2 死值 38px / 34px */
.dc-theme-btn{
  width:var(--btn-round);height:var(--btn-round);
  min-width:var(--btn-round);
  border-radius:50%;flex:none;
  border:1px solid var(--line);
  background:var(--surface);color:var(--ink);
  display:inline-flex;align-items:center;justify-content:center;
  cursor:pointer;padding:0;
  transition:border-color .18s,color .18s,background .18s;
}
.dc-theme-btn:hover{border-color:var(--cinnabar);color:var(--cinnabar)}
.dc-theme-btn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.dc-theme-btn .i-moon{display:none}
html.dark .dc-theme-btn .i-sun{display:none}
html.dark .dc-theme-btn .i-moon{display:block}
@media (max-width:720px){
  .dc-brand-t{display:none}
  .dc-nav{gap:8px;padding:8px 10px}
}
</style>