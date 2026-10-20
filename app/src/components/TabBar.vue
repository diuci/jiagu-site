<script setup lang="ts">
// 移动端底部标签栏：八站数据单源 core/tabbar.json（正本 _deploy，sync 拷贝，
// check-core R3 钉结构）。当前项按 hostname 判定。样式单源 core/chrome.css（v3）。
import tabbarData from '../../../core/tabbar.json'

const tabs = tabbarData.tabs.map((x) => ({
  ...x,
  on: typeof location !== 'undefined' && x.href.includes(location.hostname),
}))
</script>

<template>
  <nav class="dc-tabbar" aria-label="快捷导航">
    <a v-for="tab in tabs" :key="tab.href" :class="['dc-tab', tab.on ? 'on' : '']" :href="tab.href"
       :aria-current="tab.on ? 'page' : undefined">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
        <path v-for="(d, i) in tab.paths" :key="i" :d="d" />
      </svg>
      <span class="tx">{{ tab.label }}</span>
    </a>
  </nav>
</template>
