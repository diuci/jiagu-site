<script setup lang="ts">
import { computed } from 'vue'
import { store, startDaily, startPractice, pick, corpus } from '../logic/store'

const props = defineProps<{ mode: 'daily' | 'practice' }>()
defineEmits<{ (e: 'next'): void }>()

const types = computed(() => Array.from(new Set(corpus.chars.map((c) => c.type))))

const glyphUrl = computed(() => {
  if (!store.char) return ''
  // 甲骨形图在 /glyphs/<type>/<id>.png
  return '/glyphs/' + store.char.glyph
})

const explanation = computed(() => {
  const c = store.char
  if (!c) return ''
  return '「' + c.char + '」属「' + c.type + '」类，难度 ' + '★'.repeat(c.difficulty) + '。甲骨形的推演见内容仓字条。'
})
</script>

<template>
  <div class="game">
    <div v-if="mode === 'practice'" class="filter">
      <span>字类：</span>
      <button v-for="t in types" :key="t" @click="startPractice(t)">{{ t }}</button>
    </div>

    <div class="board">
      <img :src="glyphUrl" :alt="store.char ? store.char.char + ' 的甲骨形' : '甲骨形'" class="glyph" />
      <p class="q">这是哪个现代汉字？</p>
    </div>

    <div class="choices">
      <button
        v-for="c in store.choices"
        :key="c"
        class="choice"
        :class="{
          ok: store.answered && c === store.char?.char,
          bad: store.answered && c === store.picked && !store.correct,
        }"
        :disabled="store.answered"
        @click="pick(c)"
      >
        {{ c }}
      </button>
    </div>

    <div v-if="store.answered" class="feedback" :class="{ good: store.correct, bad: !store.correct }">
      <p>{{ store.correct ? '对了！' : '不对，答案是「' + (store.char?.char || '') + '」。' }}</p>
      <p class="expl">{{ explanation }}</p>
    </div>

    <div class="bar">
      <span>连击 {{ store.streak }}</span>
      <span>已解 {{ store.solved }}</span>
      <button @click="mode === 'daily' ? startDaily() : startPractice()">下一字</button>
    </div>
  </div>
</template>
