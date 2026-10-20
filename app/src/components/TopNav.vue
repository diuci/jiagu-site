<script setup lang="ts">
// 顶栏：牌子 | 八项乐园 | 明暗钮。结构与样式单源 core/chrome.css（PLAN-全站统一-v3）——
// 本组件只出 DOM：dc-nav-in 1160 网格、40px 渐变印章、21px 站名 + DIUCI 副标、
// 衬线 14.5px 下划线乐园链接，全部由 chrome.css 提供，这里不写一条布局样式。
//
// 本站不摆繁简钮：内容是古文字与今字对照，不存在简繁两套，按规范 §3「不许静默择一」
// 摆了就是点了没反应。已在 tools/check-ui.config.json 里写明豁免与原因。
import { ref, onMounted } from 'vue'
import { toggleTheme as coreToggle } from '../../../core/theme.mjs'
import parksData from '../../../core/parks.json'

const dark = ref(false)
const menuOpen = ref(false)

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

// 顶部菜单（v4.1）：小屏点开全部八站；点外/Escape 收起
function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

onMounted(() => {
  // 首帧脚本已按 cookie/系统偏好定好 data-theme，这里只取当前态
  dark.value = document.documentElement.dataset.theme === 'dark'
  document.addEventListener('click', (e) => {
    const n = e.target
    if (menuOpen.value && n instanceof Element && !n.closest('.dc-menu') && !n.closest('.dc-menu-btn')) menuOpen.value = false
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menuOpen.value = false })
})

// 顶栏乐园数据单源 core/parks.json（当前项按 hostname 判定）
const PARKS = parksData.parks.map((p) => ({
  ...p,
  on: typeof location !== 'undefined' && p.href.includes(location.hostname),
}))
</script>

<template>
  <nav class="dc-nav">
    <div class="dc-nav-in">
      <a class="dc-brand" href="https://jiagu.diuci.com/">
        <span class="dc-seal">画</span>
        <span class="dc-brand-tx">
          <span class="dc-brand-t">画甲骨</span>
          <span class="dc-brand-s">DIUCI</span>
        </span>
      </a>
      <div class="dc-nav-links" aria-label="八个乐园">
        <a v-for="p in PARKS" :key="p.href" :href="p.href"
           :aria-current="p.on ? 'page' : undefined" :class="{ on: p.on }">{{ p.label }}</a>
      </div>
      <button class="dc-menu-btn" type="button" aria-label="全部乐园" title="全部乐园"
              :aria-expanded="menuOpen ? 'true' : 'false'" @click.stop="toggleMenu">
        <svg class="i-bars" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6.8h16M4 12h16M4 17.2h16"/>
        </svg>
        <svg class="i-x" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
      <button class="dc-theme-btn" type="button" aria-label="切换深色模式" title="切换深色模式" @click="toggleTheme">
        <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2"/>
          <path d="M12 2.4v2.1M12 19.5v2.1M2.4 12h2.1M19.5 12h2.1M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M18.8 5.2l-1.5 1.5M6.7 17.3l-1.5 1.5"/>
        </svg>
        <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8z"/>
        </svg>
      </button>
      <nav class="dc-menu" :hidden="!menuOpen" aria-label="全部乐园">
        <div class="dc-menu-in">
          <a v-for="p in PARKS" :key="p.href" :href="p.href"
             :aria-current="p.on ? 'page' : undefined" :class="{ on: p.on }">{{ p.label }}</a>
        </div>
      </nav>
    </div>
  </nav>
</template>
