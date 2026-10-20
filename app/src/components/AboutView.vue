<script setup lang="ts">
import { corpus } from '../logic/store'
</script>

<template>
  <div class="about">
    <h2>关于《画甲骨》</h2>
    <p>本站是「丢词夺理」生态的甲骨文分站。内容来自开源甲骨文内容库 <code>chinese-oracle-bone-script</code>，共 {{ corpus.count }} 字。</p>
    <p>玩法：看今字，画它的甲骨形——临摹 / 描红 / 自由画三档（每日题）；自由练习里也可以看甲骨形猜字（四选一）。每天打开练一个新字。</p>
    <p>甲骨卜辞原文属商代公有领域；字源解说 © 丢词大作战，CC BY 4.0。侵权联系 hi@diuci.com。</p>
  </div>
</template>
