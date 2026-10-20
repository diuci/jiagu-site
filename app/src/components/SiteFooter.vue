<script setup lang="ts">
// 页脚：牌子 / 内容从哪来 / 许可免责 —— 右：八项乐园 + 三个说明页 + 邮箱（规范 §6）。
// 结构与样式单源 core/chrome.css（PLAN-全站统一-v3）：满宽 surface-3 + 1160 内层。
// 说明类内容只在这里出现，顶栏与侧栏都不摆——一处入口，四种地方摆 = 孩子找不到、大人改不完。
import parksData from '../../../core/parks.json'
</script>

<template>
  <footer class="dc-foot">
    <div class="dc-foot-in">
      <div class="dc-foot-l">
        <a href="https://diuci.com/">丢词夺理 diuci.com</a> · 字条来自 chinese-oracle-bone-script · 注释 CC BY 4.0 · 代码 MIT ·
        <a href="https://k12.diuci.com/legal">版权与免责</a>
      </div>
      <nav aria-label="八个乐园">
        <a v-for="p in parksData.parks" :key="p.href" :href="p.href">{{ p.label }}</a>
        <a href="mailto:hi@diuci.com">hi@diuci.com</a>
      </nav>
    </div>
  </footer>
</template>
