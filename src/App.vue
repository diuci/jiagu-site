<script setup lang="ts">
import { ref } from 'vue'
import GameView from './components/GameView.vue'
import AboutView from './components/AboutView.vue'

const tab = ref<'daily' | 'practice' | 'about'>('daily')
</script>

<template>
  <div class="app">
    <header class="hdr">
      <h1>甲骨猜字</h1>
      <p class="sub">看图猜今字 · 同一天所有人同字</p>
    </header>

    <nav class="tabs">
      <button :class="{ on: tab === 'daily' }" @click="tab = 'daily'">每日题</button>
      <button :class="{ on: tab === 'practice' }" @click="tab = 'practice'">自由练习</button>
      <button :class="{ on: tab === 'about' }" @click="tab = 'about'">关于</button>
    </nav>

    <main class="main">
      <GameView v-if="tab !== 'about'" :key="tab" :mode="tab" @next="tab = tab" />
      <AboutView v-else />
    </main>
  </div>
</template>
