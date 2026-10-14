<script setup lang="ts">
import { corpus } from '../logic/store'
</script>

<template>
  <div class="about">
    <h2>关于《甲骨猜字》</h2>
    <p>本站是「丢词夺理」生态的甲骨文分站。内容来自开源甲骨文内容库 <code>chinese-oracle-bone-script</code>，共 {{ corpus.count }} 字。</p>
    <p>玩法：看甲骨形，猜现代汉字，四选一。同一天所有人同一字（每日题），也可按字类自由练习。</p>
    <p>甲骨卜辞原文属商代公有领域；字源解说 © 丢词大作战，CC BY 4.0。侵权联系 hi@diuci.com。</p>
  </div>
</template>
