<script setup lang="ts">
import { computed, ref } from 'vue'
import { store, startDaily, startPractice, pick, submitDraw, corpus } from '../logic/store'
import { scoreDraw, judge, strokeToPrim } from '../logic/draw.mjs'
import DrawBoard from './DrawBoard.vue'

const props = defineProps<{ mode: 'daily' | 'practice' }>()
defineEmits<{ (e: 'next'): void }>()
const mode = props.mode

// 拍板 2026-10-19（待决 2 方案 B）：每日题只画画；自由练习里画画/猜字并存。
const style = ref<'draw' | 'guess'>('draw')
const level = ref<'trace' | 'copy' | 'free'>('copy') // 每日题固定 copy（描红主力档），练习可换

const types = computed(() => Array.from(new Set(corpus.chars.map((c) => c.type))))

const glyphUrl = computed(() => (store.char ? '/glyphs/' + store.char.glyph : ''))
const scanUrl = computed(() => (store.char?.scan ? '/glyphs/' + store.char.scan : ''))

const explanation = computed(() => {
  const c = store.char
  if (!c) return ''
  return '「' + c.char + '」属「' + c.type + '」类，难度 ' + '★'.repeat(c.difficulty) + '。甲骨形的推演见内容仓字条。'
})

// ---- 画字流 ----
const drawStrokes = ref(0)
const drawSim = ref<number | null>(null)
const drawVerdict = ref<{ pass: boolean; stars: number } | null>(null)
const myDrawing = ref('') // 画布快照（verdict 三栏之一）

function onDrawSubmit(strokes: Array<Array<{ x: number; y: number }>>) {
  if (!store.char || !store.char.strokes) return
  const prims = strokes.map(strokeToPrim)
  const sim = scoreDraw(prims, store.char.strokes, level.value)
  const v = judge(sim, level.value)
  drawSim.value = sim
  drawVerdict.value = v
  const el = document.querySelector('.draw') as HTMLCanvasElement | null
  try { myDrawing.value = el ? el.toDataURL() : '' } catch { myDrawing.value = '' }
  submitDraw(sim, v.pass)
}

function retryDraw() {
  drawSim.value = null
  drawVerdict.value = null
  myDrawing.value = ''
  drawStrokes.value = 0
}

function nextChar() {
  retryDraw()
  if (mode === 'daily') startDaily()
  else startPractice()
}
</script>

<template>
  <div class="game">
    <div v-if="mode === 'practice'" class="filter">
      <span>玩法：</span>
      <button :class="{ on: style === 'draw' }" @click="style = 'draw'">画字</button>
      <button :class="{ on: style === 'guess' }" @click="style = 'guess'">猜字</button>
      <span class="sep">字类：</span>
      <button v-for="t in types" :key="t" @click="startPractice(t)">{{ t }}</button>
    </div>

    <!-- ============ 画字 ============ -->
    <template v-if="style === 'draw'">
      <div v-if="mode === 'practice'" class="levels">
        <span>档位：</span>
        <button :class="{ on: level === 'trace' }" @click="level = 'trace'; retryDraw()">临摹</button>
        <button :class="{ on: level === 'copy' }" @click="level = 'copy'; retryDraw()">描红</button>
        <button :class="{ on: level === 'free' }" @click="level = 'free'; retryDraw()">自由画</button>
      </div>

      <div class="board">
        <p class="target">「<b class="big">{{ store.char?.char }}</b>」的甲骨形这样画：</p>
        <DrawBoard
          :key="store.char?.id + level + (mode === 'daily' ? store.day : '')"
          :glyph-url="glyphUrl"
          :level="mode === 'daily' ? 'copy' : level"
          :disabled="!!drawVerdict"
          @submit="onDrawSubmit"
        />
      </div>

      <div v-if="drawVerdict" class="feedback" :class="{ good: drawVerdict.pass, bad: !drawVerdict.pass }">
        <p v-if="drawVerdict.pass">
          {{ ['', '差不多！', '很像！', '画得真好！'][drawVerdict.stars] }}
          <span class="sim">相似度 {{ Math.round((drawSim || 0) * 100) }}%</span>
        </p>
        <p v-else>再试一次——照着淡影描，或者换个档位。</p>
        <p class="expl">{{ explanation }}</p>
        <!-- 拍板 1（方案 A）：画完三栏并排——我画的 → 渲染字形 → 原拓片 -->
        <div class="tri">
          <figure v-if="myDrawing">
            <img :src="myDrawing" alt="我画的" class="tri-img" />
            <figcaption>我画的</figcaption>
          </figure>
          <figure>
            <img :src="glyphUrl" :alt="store.char?.char + ' 的渲染字形'" class="tri-img" />
            <figcaption>示意形</figcaption>
          </figure>
          <figure v-if="scanUrl">
            <img :src="scanUrl" :alt="(store.char?.char || '') + (store.char?.scanKind === 'ref' ? ' 的甲骨原形参考图' : ' 的原骨片拓片')" class="tri-img" />
            <figcaption>{{ store.char?.scanKind === 'ref' ? '甲骨原形（参考图）' : '原拓片' }}</figcaption>
          </figure>
        </div>
      </div>

      <div class="bar">
        <span v-if="mode === 'practice'">连击 {{ store.streak }}</span>
        <span>已解 {{ store.solved }}</span>
        <button v-if="drawVerdict" @click="nextChar">下一字</button>
      </div>
    </template>

    <!-- ============ 猜字（自由练习保留，拍板 2 方案 B） ============ -->
    <template v-else>
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
        <button @click="startPractice()">下一字</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.filter, .levels { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.filter button, .levels button {
  padding: 4px 11px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--surface-hi); color: var(--ink);
  font-size: 14px; cursor: pointer; font-family: var(--round);
}
.filter button.on, .levels button.on { background: var(--c-primary); border-color: var(--c-primary); color: var(--paper); }
.filter .sep { margin-left: 10px; color: var(--ink-faint); }
.target { text-align: center; color: var(--ink-soft); font-size: 16px; margin: 0 0 8px; }
.big { font-family: var(--serif); font-size: 34px; color: var(--c-primary); }
.tri { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
.tri figure { margin: 0; text-align: center; }
.tri-img { width: 96px; height: 96px; object-fit: contain; background: var(--paper-2); border-radius: 8px; border: 1px solid var(--line); }
figcaption { font-size: 12px; color: var(--ink-faint); margin-top: 4px; }
.sim { color: var(--ink-faint); font-size: 13px; }
</style>
